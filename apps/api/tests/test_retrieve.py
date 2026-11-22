from collections.abc import Iterable
from typing import Any

import pytest
from llama_index.core.retrievers import BaseRetriever
from llama_index.core.schema import NodeWithScore, QueryBundle, TextNode
from llama_index.vector_stores.postgres import PGVectorStore

from atlas_api import retrieve
from atlas_api.access import chunk_filters
from atlas_api.models import EVERYONE, Department, Role, User


def user(role: Role, *depts: str, org_id: int = 7) -> User:
    return User(org_id=org_id, role=role, departments=[Department(name=d) for d in depts])


def where(u: User) -> str:
    """The SQL PGVectorStore puts in the WHERE clause (no database needed)."""
    store = PGVectorStore(
        connection_string="postgresql://x", async_connection_string="postgresql+asyncpg://x"
    )
    return str(store._recursively_apply_filters(chunk_filters(u)))  # type: ignore[arg-type]


def test_admin_sees_whole_org_only() -> None:
    assert where(user(Role.admin)) == "(metadata_->>'org_id')::float = 7.0"


@pytest.mark.parametrize("role", [Role.manager, Role.member])
def test_departments_or_everyone(role: Role) -> None:
    sql = where(user(role, "HR", "Finance"))
    assert sql.startswith("(metadata_->>'org_id')::float = 7.0 AND (")
    assert (
        f"metadata_->>'access' = '{EVERYONE}' OR metadata_->>'access' IN ('Finance', 'HR')" in sql
    )


def test_guest_everyone_only() -> None:
    assert where(user(Role.guest)) == (
        f"(metadata_->>'org_id')::float = 7.0 AND metadata_->>'access' = '{EVERYONE}'"
    )


def test_other_org_is_its_own_filter() -> None:
    assert where(user(Role.member, "HR", org_id=8)).startswith(
        "(metadata_->>'org_id')::float = 8.0"
    )


def test_quotes_are_escaped() -> None:
    assert "IN ('O''Brien''s team')" in where(user(Role.member, "O'Brien's team"))


def test_superseded_penalty() -> None:
    old = {"title": "Leave Policy FY2024-25", "doc_no": "NIM/HR/POL-003", "superseded": True}
    assert retrieve.penalty("How many leave days?", old) == retrieve.SUPERSEDED_PENALTY
    assert retrieve.penalty("What did leave policy fy2024-25 say?", old) == 0
    assert retrieve.penalty("What does NIM/HR/POL-003 say?", old) == 0
    assert retrieve.penalty("How many leave days?", old | {"superseded": False}) == 0


def node(name: str, superseded: bool = False) -> TextNode:
    return TextNode(id_=name, text=name, metadata={"title": name, "superseded": superseded})


class Fixed(BaseRetriever):
    def __init__(self, names: Iterable[str]) -> None:
        super().__init__()
        self.names = list(names)

    def _retrieve(self, query_bundle: QueryBundle) -> list[NodeWithScore]:
        return [NodeWithScore(node=NODES[n], score=1 / i) for i, n in enumerate(self.names, 1)]


NODES = {n: node(n, superseded=n == "old") for n in ["a", "b", "c", "old"]}


class FakeEncoder:
    """Scores by a fixed table; 'old' would win without the superseded penalty."""

    def rerank(self, q: str, texts: list[str], **_: Any) -> list[float]:
        table = {"a": 1.0, "b": 2.0, "c": 3.0, "old": 2.5}
        return [table[t.rsplit("\n", 1)[-1]] for t in texts]


def parts(vector: list[str], keyword: list[str]) -> tuple[retrieve.Recorded, retrieve.Recorded]:
    return retrieve.Recorded(Fixed(vector)), retrieve.Recorded(Fixed(keyword))


def test_rrf_fuses_both_lists() -> None:
    res = retrieve.search("q", None, "hybrid", parts=parts(["a", "b", "c"], ["b", "c"]))  # type: ignore[arg-type]
    assert [n.node.node_id for n in res.stages["vector"]] == ["a", "b", "c"]
    assert [n.node.node_id for n in res.stages["keyword"]] == ["b", "c"]
    fused = res.stages["fused"]
    # LlamaIndex RRF: 1/(60 + rank), rank from 0. b: 1/61 + 1/60 > c: 1/62 + 1/61 > a: 1/60.
    assert [n.node.node_id for n in fused] == ["b", "c", "a"]
    assert fused[0].score == pytest.approx(1 / 61 + 1 / 60)
    assert res.stages["vector"][0].score == 1.0  # recorded lists keep their own scores
    assert set(res.ms) == {"vector", "keyword", "fusion"}


def test_rerank_orders_by_cross_encoder_with_penalty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(retrieve, "cross_encoder", FakeEncoder)
    monkeypatch.setattr(retrieve, "SUPERSEDED_PENALTY", 1.0)
    res = retrieve.search(
        "q",
        None,  # type: ignore[arg-type]
        "hybrid_rerank",
        top_k=3,
        parts=parts(["a", "b", "old"], ["a", "b"]),
    )
    assert [n.node.node_id for n in res.final] == ["b", "old", "a"]
    assert res.final[1].score == pytest.approx(2.5 - 1.0)  # scores are cross-encoder logits
    assert "rerank" in res.ms


def test_rerank_only_the_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(retrieve, "cross_encoder", FakeEncoder)
    monkeypatch.setattr(retrieve, "RERANK_POOL", 2)
    res = retrieve.search(
        "q",
        None,  # type: ignore[arg-type]
        "hybrid_rerank",
        top_k=1,
        parts=parts(["a", "b", "c"], ["a", "b"]),
    )
    # c scores highest but is hybrid #3, outside the pool of 2.
    assert [n.node.node_id for n in res.stages["fused"]] == ["a", "b", "c"]
    assert [n.node.node_id for n in res.final] == ["b"]
    # top_k above the pool reranks top_k nodes.
    res = retrieve.search(
        "q",
        None,  # type: ignore[arg-type]
        "hybrid_rerank",
        top_k=3,
        parts=parts(["a", "b", "c"], ["a", "b"]),
    )
    assert [n.node.node_id for n in res.final] == ["c", "b", "a"]


def test_single_modes_skip_fusion() -> None:
    res = retrieve.search("q", None, "keyword", parts=parts(["a"], ["c"]))  # type: ignore[arg-type]
    assert list(res.stages) == ["keyword"]
    assert [n.node.node_id for n in res.final] == ["c"]
