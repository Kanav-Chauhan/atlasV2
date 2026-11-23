"""The document viewer's endpoints (UI Phase 2): metadata, the file inline or as a download,
and the extracted text. Same access rule as everything else. No database: a fake session."""

from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from atlas_api.main import app
from atlas_api.models import Department, Document, Organization, Role, Status, User
from atlas_api.routes import current_user, db, merge_chunks


def user(role: Role, *depts: str, org_id: int = 1) -> User:
    return User(
        id=1,
        org_id=org_id,
        email=f"{role}@x.example",
        name=str(role),
        title="",
        role=role,
        org=Organization(id=org_id, slug="x", name="X", industry="", description=""),
        departments=[Department(name=d) for d in depts],
    )


def doc(tmp: Path, id: int, access: str, fmt: str, body: bytes) -> Document:
    path = tmp / f"{id}.{fmt}"
    path.write_bytes(body)
    return Document(
        id=id,
        org_id=1,
        title=f"Doc {id}",
        doc_no=None,
        access=access,
        is_public=False,
        format=fmt,
        status=Status.ready,
        error=None,
        file_path=str(path),
        pages=1,
        chunks=2,
        version=None,
        effective=None,
        superseded_by=None,
        updated_at=datetime(2026, 11, 1, tzinfo=UTC),
    )


class Rows(list[tuple[str, str, dict[str, Any]]]):
    def all(self) -> list[Any]:
        return list(self)


class FakeSession:
    def __init__(self, docs: list[Document], chunks: list[str] | None = None) -> None:
        self.docs = {d.id: d for d in docs}
        self.chunks = chunks or []

    async def get(self, model: Any, id: int) -> Any:
        return self.docs.get(id) if model is Document else None

    async def execute(self, *a: Any) -> Rows:
        return Rows((f"n{i}", t, {}) for i, t in enumerate(self.chunks))

    async def scalar(self, q: Any) -> Any:
        return None

    async def scalars(self, q: Any) -> list[Any]:
        return []

    async def commit(self) -> None:
        pass


PDF = b"%PDF-1.4\n%fake\n"


@pytest.fixture
def docs(tmp_path: Path) -> list[Document]:
    return [
        doc(tmp_path, 1, "Everyone", "pdf", PDF),
        doc(tmp_path, 2, "HR", "pdf", PDF),
        doc(tmp_path, 3, "Everyone", "md", b"# Title\n\nHello **world**."),
        doc(tmp_path, 4, "Everyone", "docx", b"PK\x03\x04"),
    ]


def client(actor: User, session: FakeSession) -> AsyncClient:
    app.dependency_overrides[current_user] = lambda: actor
    app.dependency_overrides[db] = lambda: session
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture(autouse=True)
def _clear_overrides() -> Iterator[None]:
    yield
    app.dependency_overrides.clear()


async def test_file_downloads_by_default_and_opens_inline_on_request(docs: list[Document]) -> None:
    async with client(user(Role.member), FakeSession(docs)) as c:
        r = await c.get("/documents/1/file")
        assert r.status_code == 200
        assert r.headers["content-disposition"].startswith("attachment")
        r = await c.get("/documents/1/file?inline=1")
        assert r.status_code == 200
        assert r.headers["content-disposition"].startswith("inline")
        assert r.headers["content-type"] == "application/pdf"
        assert r.headers["x-content-type-options"] == "nosniff"
        assert r.content == PDF
        r = await c.get("/documents/3/file?inline=1")
        assert r.headers["content-type"] == "text/markdown; charset=utf-8"


@pytest.mark.parametrize("inline", ["", "?inline=1"])
@pytest.mark.parametrize("path", ["", "/file", "/text", "/chunks"])
async def test_inline_does_not_weaken_access(docs: list[Document], path: str, inline: str) -> None:
    """A member outside HR, a guest, and an admin of another company get the same 404."""
    for actor in (user(Role.member, "Sales"), user(Role.guest), user(Role.admin, org_id=2)):
        async with client(actor, FakeSession(docs)) as c:
            r = await c.get(f"/documents/2{path}{inline}")
            assert r.status_code == 404
            assert PDF not in r.content
    async with client(user(Role.member, "HR"), FakeSession(docs)) as c:
        assert (await c.get(f"/documents/2{path}{inline}")).status_code == 200


async def test_document_metadata(docs: list[Document]) -> None:
    async with client(user(Role.member), FakeSession(docs)) as c:
        body = (await c.get("/documents/1")).json()
        assert body["title"] == "Doc 1"
        assert body["access"] == "Everyone"
        assert "file_path" not in body
        assert (await c.get("/documents/99")).status_code == 404


async def test_metadata_route_does_not_shadow_review(docs: list[Document]) -> None:
    async with client(user(Role.admin), FakeSession(docs)) as c:
        assert (await c.get("/documents/review")).status_code == 200


async def test_text_markdown_from_file_and_docx_from_chunks(docs: list[Document]) -> None:
    chunks = [
        "# Policy\n\nFirst part. Shared tail sentence here.",
        "Shared tail sentence here. Next.",
    ]
    async with client(user(Role.member), FakeSession(docs, chunks)) as c:
        md = (await c.get("/documents/3/text")).json()
        assert md == {"format": "md", "markdown": "# Title\n\nHello **world**."}
        docx = (await c.get("/documents/4/text")).json()
        assert docx["markdown"] == "# Policy\n\nFirst part. Shared tail sentence here. Next."


def test_merge_chunks() -> None:
    assert merge_chunks([]) == ""
    # Separate sections join with a blank line; a short accidental match is not an overlap.
    assert merge_chunks(["# A\n\nOne.", "# B\n\nTwo."]) == "# A\n\nOne.\n\n# B\n\nTwo."
    assert merge_chunks(["ends with x.", "x. starts"]) == "ends with x.\n\nx. starts"
    long = "The overlap repeats this whole sentence."
    assert merge_chunks([f"Start. {long}", f"{long} End."]) == f"Start. {long} End."


def test_visitors_have_no_file_route() -> None:
    """Website visitors reach only /public/...; none of those routes serves a file."""
    paths = [getattr(r, "path", "") for r in app.routes]
    assert not [p for p in paths if p.startswith("/public") and ("file" in p or "text" in p)]
