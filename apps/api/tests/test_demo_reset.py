"""Demo reset (demo_reset.py) on a real database: mess up Nimbus the ways the UI allows, reset,
check it is clean again. Needs Postgres (CI service) and the repo's demo_corpus."""

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import delete, func, select, text

from atlas_api import demo_reset, website, worker
from atlas_api.db import CHUNKS_TABLE, SyncSession
from atlas_api.ingest import store
from atlas_api.models import Chat, Department, Document, DocumentRequest, Organization, Role, User
from atlas_api.scripts.load_corpus import corpus_docs
from atlas_api.scripts.seed import seed_org
from atlas_api.settings import settings

pytestmark = pytest.mark.integration

CORPUS = Path(__file__).resolve().parents[3] / "demo_corpus"
SLUG = "nimbus"


@pytest.fixture
def nimbus(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[dict[str, Any]]:
    monkeypatch.setattr(settings, "corpus_dir", str(CORPUS))
    monkeypatch.setattr(settings, "files_dir", str(tmp_path))
    queued: list[int] = []
    monkeypatch.setattr(worker.ingest_document, "delay", lambda doc_id: queued.append(doc_id))
    store()._initialize()  # the chunks table, as ingestion creates it
    data = json.loads((CORPUS / "orgs" / f"{SLUG}.json").read_text())
    with SyncSession() as s:
        s.execute(delete(Organization).where(Organization.slug == SLUG))  # stale run
        org = seed_org(s, data)
        for values in corpus_docs(SLUG):
            s.add(Document(org_id=org.id, **values))
        s.commit()
        org_id = org.id
    yield {"org_id": org_id, "data": data, "queued": queued, "files": tmp_path}
    with SyncSession() as s:
        s.execute(
            text(f"DELETE FROM {CHUNKS_TABLE} WHERE metadata_->>'org_id' = :o"),  # noqa: S608
            {"o": str(org_id)},
        )
        s.execute(delete(Organization).where(Organization.id == org_id))
        s.commit()


def add_chunk(s: Any, doc: Document) -> None:
    meta = {
        "org_id": str(doc.org_id),
        "document_id": str(doc.id),
        "access": doc.access,
        "is_public": doc.is_public,
    }
    s.execute(
        text(
            f"INSERT INTO {CHUNKS_TABLE} (text, metadata_, node_id)"  # noqa: S608
            " VALUES ('x', CAST(:m AS jsonb), :n)"
        ),
        {"m": json.dumps(meta), "n": f"test-{doc.id}"},
    )


def chunk_meta(s: Any, doc_id: int) -> dict[str, Any]:
    return dict(
        s.scalar(
            text(f"SELECT metadata_ FROM {CHUNKS_TABLE} WHERE metadata_->>'document_id' = :id"),  # noqa: S608
            {"id": str(doc_id)},
        )
    )


def test_reset_puts_a_messed_up_demo_back(nimbus: dict[str, Any]) -> None:
    org_id, data = nimbus["org_id"], nimbus["data"]
    upload = nimbus["files"] / "upload.md"
    upload.write_text("# Secret plan\n")
    with SyncSession() as s:
        org = s.get(Organization, org_id)
        assert org is not None
        hr_doc = s.scalar(
            select(Document).where(Document.org_id == org_id, Document.access == "HR")
        )
        assert hr_doc is not None
        add_chunk(s, hr_doc)
        hr_id = hr_doc.id
        # shared on the website + moved to another department, chunk metadata follows (as the UI)
        hr_doc.is_public, hr_doc.access, hr_doc.title = True, "Everyone", "Renamed"
        s.execute(
            text(
                f"UPDATE {CHUNKS_TABLE} SET metadata_ = metadata_ || "  # noqa: S608
                '\'{"is_public": true, "access": "Everyone"}\' '
                "WHERE metadata_->>'document_id' = :id"
            ),
            {"id": str(hr_id)},
        )
        # a deleted clean document, an upload
        gone = s.scalar(select(Document).where(Document.org_id == org_id, Document.id != hr_id))
        assert gone is not None
        gone_sha = gone.sha256
        s.delete(gone)
        s.add(
            Document(
                org_id=org_id,
                title="Secret plan",
                access="Everyone",
                format="md",
                file_path=str(upload),
                sha256="f" * 64,
            )
        )
        # team: a stranger added, an employee promoted, a department renamed + a new one
        s.add(User(org_id=org_id, email="stranger@x.test", name="S", role=Role.admin))
        employee = s.scalar(select(User).where(User.email == data["users"][-1]["email"]))
        assert employee is not None
        employee.role = Role.admin
        hr = s.scalar(
            select(Department).where(Department.org_id == org_id, Department.name == "HR")
        )
        assert hr is not None
        hr.name = "People"
        s.add(Department(org_id=org_id, name="Fun"))
        # settings + activity
        org.name, org.description = "Hacked Ltd", "pwned"
        org.website_chat = website.config(org) | {"site_key": "rotated", "greeting": "yo"}
        s.add(Chat(id="c1", user_id=employee.id, org_id=org_id, title="hi"))
        s.add(Chat(id="v1", user_id=None, org_id=org_id, title="visitor", origin="https://x"))
        s.add(DocumentRequest(org_id=org_id, user_id=employee.id, question="pls"))
        s.commit()

    out = demo_reset.reset_org(SLUG)

    assert out["uploads_deleted"] == 1 and out["documents_reingested"] == 1
    assert out["documents_restored"] == 1 and out["chunks_synced"] == 1
    assert out["people_deleted"] == 1 and out["departments_deleted"] == 2  # People, Fun
    assert out["chats"] == 2 and out["requests"] == 1
    assert not upload.exists()
    clean = {d["sha256"]: d for d in corpus_docs(SLUG)}
    with SyncSession() as s:
        docs = list(s.scalars(select(Document).where(Document.org_id == org_id)))
        assert {d.sha256 for d in docs} == set(clean)
        assert nimbus["queued"] == [d.id for d in docs if d.sha256 == gone_sha]
        hr_doc = s.get(Document, hr_id)
        assert hr_doc is not None
        want = clean[hr_doc.sha256]
        assert (hr_doc.title, hr_doc.access, hr_doc.is_public) == (
            want["title"],
            "HR",
            False,
        )
        meta = chunk_meta(s, hr_id)
        assert meta["access"] == "HR" and meta["is_public"] is False
        emails = set(s.scalars(select(User.email).where(User.org_id == org_id)))
        assert emails == {u["email"] for u in data["users"]}
        employee = s.scalar(select(User).where(User.email == data["users"][-1]["email"]))
        assert employee is not None and employee.role == Role(data["users"][-1]["role"])
        depts = set(s.scalars(select(Department.name).where(Department.org_id == org_id)))
        assert depts == {d["name"] for d in data["departments"]}
        org = s.get(Organization, org_id)
        assert org is not None
        assert (org.name, org.description) == (data["name"], "")
        assert org.website_chat == website.demo_config(data["site_key"], data["accent"])
        assert s.scalar(select(func.count()).select_from(Chat).where(Chat.org_id == org_id)) == 0


def test_reset_refuses_other_companies() -> None:
    with pytest.raises(ValueError, match="not a demo company"):
        demo_reset.reset_org("acme")
