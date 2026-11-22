"""CI retrieval eval gate (smoke): a tiny fixture org (5 markdown docs, 4 people, 3 departments)
is ingested and scored with the real eval code (scripts/eval_retrieval.run, hybrid_rerank).
No demo corpus and no LLM needed; it fails when Hit@5 drops or any permission leaks.

The full eval (199 documents, 187 questions) stays a manual/nightly command:
    python -m atlas_api.scripts.eval_retrieval      (retrieval, docs/RAG_GUIDE.md step 9)
    python -m atlas_api.scripts.eval_answers        (answers: RAGAS + correctness, uses LLMs)
"""

import hashlib
import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import delete, select

from atlas_api.db import SyncSession
from atlas_api.ingest import delete_chunks
from atlas_api.models import Document, Organization, User
from atlas_api.scripts.eval_retrieval import run
from atlas_api.scripts.seed import seed_org
from atlas_api.worker import ingest_document

pytestmark = pytest.mark.integration
FIXTURE = Path(__file__).parent / "fixtures" / "eval_smoke"


@pytest.fixture(scope="module")
def smoke_org() -> Iterator[dict[str, User]]:
    org_data = json.loads((FIXTURE / "org.json").read_text())
    with SyncSession() as s:
        s.execute(delete(Organization).where(Organization.slug == org_data["slug"]))  # stale run
        org = seed_org(s, org_data)
        docs = []
        for d in org_data["documents"]:
            path = FIXTURE / d["file"]
            doc = Document(
                org_id=org.id,
                title=d["title"],
                access=d["access"],
                format="md",
                file_path=str(path),
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
            )
            s.add(doc)
            docs.append(doc)
        s.commit()
        org_id, doc_ids = org.id, [d.id for d in docs]
    for doc_id in doc_ids:
        assert ingest_document.apply(args=[doc_id]).get() == "ready"
    with SyncSession() as s:  # org and departments load eagerly
        users = {u.email: u for u in s.scalars(select(User).where(User.org_id == org_id))}
    yield users
    for doc_id in doc_ids:
        delete_chunks(doc_id)
    with SyncSession() as s:
        s.execute(delete(Organization).where(Organization.id == org_id))
        s.commit()


def test_retrieval_gate_hit_at_5_and_zero_leaks(smoke_org: dict[str, User]) -> None:
    questions = json.loads((FIXTURE / "questions.json").read_text())["questions"]
    summary, detail = run(questions, ["hybrid_rerank"], smoke_org)
    m = summary["hybrid_rerank"]
    assert m["n"] == 7
    assert m["leaks"] == 0, [r for r in detail if r.get("leak")]
    assert m["hit_at_5"] == 1.0, [r for r in detail if r.get("hit_at_5") == 0.0]
    assert m["hit_at_1"] >= 0.85
    assert m["context_recall"] >= 0.85
