"""Small end-to-end: seed a tiny org, ingest one markdown doc, read it through the API."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, text

from atlas_api.db import CHUNKS_TABLE, SyncSession
from atlas_api.ingest import delete_chunks
from atlas_api.main import app
from atlas_api.models import Document, Organization, Status
from atlas_api.scripts.seed import seed_org
from atlas_api.worker import ingest_document

pytestmark = pytest.mark.integration

ORG = {
    "slug": "test-tiny",
    "name": "Tiny Test Co",
    "departments": [{"name": "HR"}, {"name": "Finance"}],
    "users": [
        {"name": "A", "role": "admin", "departments": [], "email": "a@tiny.test"},
        {"name": "M", "role": "member", "departments": ["Finance"], "email": "m@tiny.test"},
        {"name": "G", "role": "guest", "departments": [], "email": "g@tiny.test"},
    ],
}


@pytest.fixture(scope="module")
def hr_doc(tmp_path_factory: pytest.TempPathFactory) -> Iterator[int]:
    path = Path(tmp_path_factory.mktemp("docs")) / "leave.md"
    path.write_text(
        "# Leave Policy\n\n## Earned leave\n\nStaff get 18 days of earned leave a year.\n\n"
        "| Type | Days |\n|---|---|\n| Earned | 18 |\n| Sick | 12 |\n"
    )
    with SyncSession() as s:
        s.execute(delete(Organization).where(Organization.slug == ORG["slug"]))  # stale run
        org = seed_org(s, ORG)
        doc = Document(
            org_id=org.id,
            title="Leave Policy",
            access="HR",
            format="md",
            file_path=str(path),
            sha256="0" * 64,
        )
        s.add(doc)
        s.commit()
        org_id, doc_id = org.id, doc.id
    yield doc_id
    delete_chunks(doc_id)
    with SyncSession() as s:
        s.execute(delete(Organization).where(Organization.id == org_id))
        s.commit()


def chunk_rows(doc_id: int) -> list[tuple[str, dict[str, object]]]:
    with SyncSession() as s:
        rows = s.execute(
            text(
                f"SELECT text, metadata_ FROM {CHUNKS_TABLE} WHERE metadata_->>'document_id' = :d"
            ),
            {"d": str(doc_id)},
        )
        return [(t, m) for t, m in rows]


def test_ingest_is_idempotent(hr_doc: int) -> None:
    for _ in range(2):
        assert ingest_document.apply(args=[hr_doc]).get() == "ready"
        with SyncSession() as s:
            doc = s.get(Document, hr_doc)
            assert doc and doc.status == Status.ready
            assert doc.chunks == len(chunk_rows(hr_doc)) >= 1
    _, meta = chunk_rows(hr_doc)[0]
    assert meta["access"] == "HR" and meta["superseded"] is False and meta["is_public"] is False
    assert "| Earned | 18 |" in "".join(t for t, _ in chunk_rows(hr_doc))


@pytest.mark.parametrize(
    ("email", "sees"), [("a@tiny.test", True), ("m@tiny.test", False), ("g@tiny.test", False)]
)
async def test_documents_follow_access(hr_doc: int, email: str, sees: bool) -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://t", cookies={"atlas_demo_user": email}
    ) as c:
        ids = [d["id"] for d in (await c.get("/documents")).json()]
        assert (hr_doc in ids) is sees
        r = await c.get(f"/documents/{hr_doc}/file")
        assert r.status_code == (200 if sees else 404)
        assert (await c.get("/me")).json()["org"]["slug"] == "test-tiny"


async def test_no_cookie_is_401() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        assert (await c.get("/documents")).status_code == 401


@pytest.mark.parametrize(("email", "sees"), [("a@tiny.test", True), ("m@tiny.test", False)])
async def test_search_and_chunks_follow_access(hr_doc: int, email: str, sees: bool) -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://t", cookies={"atlas_demo_user": email}
    ) as c:
        r = await c.post("/search", json={"q": "How many days of earned leave?"})
        assert r.status_code == 200
        assert (hr_doc in {h["document_id"] for h in r.json()["results"]}) is sees
        chunks = await c.get(f"/documents/{hr_doc}/chunks")
        assert chunks.status_code == (200 if sees else 404)
        assert (await c.post("/search", json={"q": " "})).status_code == 422
