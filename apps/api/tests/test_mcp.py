"""Phase 9: MCP server. Token hashing, bearer auth (401 for unknown/revoked), per-person tool
isolation and audit rows, through a real MCP client over Streamable HTTP. No database, no Redis."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import httpx2
import pytest
from mcp import Client
from mcp.client.streamable_http import streamable_http_client

from atlas_api import mcp_server, tokens
from atlas_api.main import app
from atlas_api.mcp_server import Passage, SearchResult, join_chunks, readable_departments
from atlas_api.models import Department, Organization, Role, User

URL = "http://atlas.test/mcp"


def person(role: Role, *depts: str, id: int = 1) -> User:
    return User(
        id=id,
        org_id=1,
        email=f"{role}{id}@x.example",
        name=str(role),
        title="",
        role=role,
        org=Organization(id=1, slug="x", name="X", industry="", description=""),
        departments=[Department(name=d) for d in depts],
    )


ENGINEER = person(Role.member, "Engineering", id=2)
HR = person(Role.manager, "HR", id=3)
SECRETS = {"atl_engineer": ENGINEER, "atl_hr": HR}
REVOKED = "atl_revoked"

# Passages per department; the fake search applies the same rule as access.chunk_filters.
CORPUS = [
    ("Salary bands", "HR", "L4 band: 30-42 LPA"),
    ("Release calendar", "Engineering", "Releases ship every second Tuesday"),
    ("Leave policy", "Everyone", "Earned leave is 18 days"),
]


def fake_search(q: str, user: User, top_k: int) -> SearchResult:
    if q == "boom":
        raise RuntimeError("search is down")
    seen = [
        c
        for c in CORPUS
        if user.role == Role.admin or c[1] == "Everyone" or c[1] in user.department_names
    ]
    return SearchResult(
        passages=[
            Passage(
                title=t,
                doc_no="",
                department=d,
                page=1,
                section="/",
                text=x,
                document_id=i,
                score=1.0,
            )
            for i, (t, d, x) in enumerate(seen[:top_k])
        ],
        abstained=not seen,
    )


@pytest.fixture
def audits(monkeypatch: pytest.MonkeyPatch) -> list[tuple[int, str, bool]]:
    rows: list[tuple[int, str, bool]] = []

    async def authenticate(raw: str) -> tokens.Caller | None:
        user = SECRETS.get(raw)  # REVOKED is in no table: authenticate() returns None for it
        return tokens.Caller(token_id=user.id, token_name="t", user=user) if user else None

    async def allow(token_id: int) -> bool:
        return True

    async def audit(caller: tokens.Caller, tool: str, args: Any, ok: bool, ms: int) -> None:
        rows.append((caller.token_id, tool, ok))

    monkeypatch.setattr(tokens, "authenticate", authenticate)
    monkeypatch.setattr(tokens, "allow", allow)
    monkeypatch.setattr(tokens, "audit", audit)
    monkeypatch.setattr(mcp_server, "run_search", fake_search)
    return rows


def client(secret: str | None) -> httpx2.AsyncClient:
    headers = {"Authorization": f"Bearer {secret}"} if secret else {}
    return httpx2.AsyncClient(transport=httpx2.ASGITransport(app=app), headers=headers)


@asynccontextmanager
async def http(secret: str | None) -> AsyncIterator[httpx2.AsyncClient]:
    """Plain HTTP with the app's MCP session manager running (ASGITransport skips lifespan)."""
    async with mcp_server.lifespan(app), client(secret) as c:
        yield c


@asynccontextmanager
async def connect(secret: str) -> AsyncIterator[Client]:
    """A real MCP client (mcp.Client over Streamable HTTP) as the token's person."""
    async with (
        mcp_server.lifespan(app),
        Client(streamable_http_client(URL, http_client=client(secret))) as c,
    ):
        yield c


# ------------------------------------------------------------------ tokens


def test_token_hash_and_verify() -> None:
    raw = tokens.new_secret()
    assert raw.startswith("atl_") and len(raw) > 40
    h = tokens.hash_token(raw)
    assert len(h) == 64 and raw not in h
    assert tokens.verify(raw, h)
    assert not tokens.verify(raw + "x", h)
    assert tokens.new_secret() != raw


def test_summarize_is_bounded() -> None:
    assert tokens.summarize({"query": "x"}) == "query='x'"
    assert len(tokens.summarize({"query": "y" * 1000})) == 300


async def test_authenticate_rejects_without_db() -> None:
    assert await tokens.authenticate("not-a-token") is None
    assert await tokens.authenticate("atl_" + "x" * 200) is None


# ------------------------------------------------------------------ auth


@pytest.mark.parametrize("secret", [None, "atl_unknown", REVOKED])
async def test_bad_token_is_401(secret: str | None, audits: list[Any]) -> None:
    async with http(secret) as c:
        r = await c.post(
            URL,
            json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
            headers={"accept": "application/json, text/event-stream"},
        )
    assert r.status_code == 401
    assert r.headers["www-authenticate"].startswith("Bearer")
    assert audits == []


async def test_rate_limited_is_429(audits: list[Any], monkeypatch: pytest.MonkeyPatch) -> None:
    async def deny(token_id: int) -> bool:
        return False

    monkeypatch.setattr(tokens, "allow", deny)
    async with http("atl_engineer") as c:
        r = await c.post(URL, json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    assert r.status_code == 429


# ------------------------------------------------------------------ tools


async def test_lists_tools(audits: list[Any]) -> None:
    async with connect("atl_engineer") as client:
        names = {t.name for t in (await client.list_tools()).tools}
    assert {"ask_question", "search_knowledge", "get_document", "list_departments"} <= names


async def test_engineer_never_gets_hr_passages(audits: list[tuple[int, str, bool]]) -> None:
    async with connect("atl_engineer") as client:
        res = await client.call_tool("search_knowledge", {"query": "salary band L4"})
    assert not res.is_error
    data = res.structured_content or {}
    depts = {p["department"] for p in data["passages"]}
    assert "HR" not in depts and "Engineering" in depts
    assert audits == [(ENGINEER.id, "search_knowledge", True)]

    async with connect("atl_hr") as client:
        res = await client.call_tool("search_knowledge", {"query": "salary band L4"})
    depts = {p["department"] for p in (res.structured_content or {})["passages"]}
    assert "HR" in depts and "Engineering" not in depts
    assert audits[-1] == (HR.id, "search_knowledge", True)


async def test_unknown_tool_is_an_error(audits: list[Any]) -> None:
    async with connect("atl_engineer") as client:
        try:
            res = await client.call_tool("drop_tables", {})
        except Exception:
            return  # JSON-RPC error
    assert res.is_error
    assert audits == []


async def test_failed_call_is_audited_not_ok(audits: list[tuple[int, str, bool]]) -> None:
    async with connect("atl_hr") as c:
        res = await c.call_tool("search_knowledge", {"query": "boom"})
    assert res.is_error
    assert audits == [(HR.id, "search_knowledge", False)]


async def test_ask_question_runs_as_the_token_person(
    audits: list[tuple[int, str, bool]], monkeypatch: pytest.MonkeyPatch
) -> None:
    asked: list[tuple[str, int]] = []

    async def fake_ask(q: str, user: Any) -> mcp_server.Answer:
        asked.append((q, user.id))
        return mcp_server.Answer(
            answer="Bands are set by HR [1].",
            sources=[
                mcp_server.Source(
                    n=1, title="Pay Policy", doc_no="HR-1", page=2, section="/", document_id=7
                )
            ],
            abstained=False,
        )

    monkeypatch.setattr(mcp_server, "run_ask", fake_ask)
    async with connect("atl_hr") as client:
        res = await client.call_tool("ask_question", {"question": "  salary band L4  "})
        empty = await client.call_tool("ask_question", {"question": "   "})
    assert not res.is_error
    data = res.structured_content or {}
    assert data["answer"].endswith("[1].") and data["sources"][0]["doc_no"] == "HR-1"
    assert asked == [("salary band L4", HR.id)]
    assert empty.is_error
    assert audits == [(HR.id, "ask_question", True)]


def test_readable_departments() -> None:
    names = ["Engineering", "Finance", "HR"]
    assert readable_departments(ENGINEER, names) == ["Everyone", "Engineering"]
    assert readable_departments(person(Role.admin), names) == ["Everyone", *names]
    assert readable_departments(person(Role.guest), names) == ["Everyone"]


def test_join_chunks_drops_overlap() -> None:
    a = "# Leave\n\nEarned leave is eighteen days a year for every full-time employee here."
    b = "eighteen days a year for every full-time employee here. Sick leave is twelve days."
    assert join_chunks([a, b]) == a + " Sick leave is twelve days."
    c = "A completely different section that shares nothing at all with the text before."
    assert join_chunks([a, c]) == a + "\n\n" + c
