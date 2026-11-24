"""Replace a document's file, and who may manage which documents."""

from pathlib import Path
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from test_documents import FakeSession, doc, user

from atlas_api import access, routes
from atlas_api.main import app
from atlas_api.models import Document, Role, Status, User
from atlas_api.settings import settings


class Session(FakeSession):
    taken: Any = None

    async def scalar(self, q: Any) -> Any:
        return self.taken

    async def refresh(self, d: Any) -> None:
        pass


async def put(
    monkeypatch: pytest.MonkeyPatch, tmp: Path, who: User, d: Document, body: bytes, s: Session
) -> tuple[Any, list[int]]:
    queued: list[int] = []
    monkeypatch.setattr(routes, "queue_ingest", queued.append)
    monkeypatch.setattr(settings, "files_dir", str(tmp))
    app.dependency_overrides[routes.current_user] = lambda: who
    app.dependency_overrides[routes.db] = lambda: s
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
            r = await c.put(f"/documents/{d.id}/file", files={"file": ("new.md", body)})
    finally:
        app.dependency_overrides.clear()
    return r, queued


async def test_replace_keeps_the_document_and_drops_the_old_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    d = doc(tmp_path, 5, "HR", "pdf", b"%PDF-old")
    d.sha256, d.meta, d.effective = "old", {"review": "1 Jan 2025", "department": "HR"}, "2024"
    old = Path(d.file_path)
    r, queued = await put(
        monkeypatch, tmp_path, user(Role.manager, "HR"), d, b"# New", Session([d])
    )
    assert r.status_code == 200, r.text
    assert (d.id, d.title, d.access, d.format) == (5, "Doc 5", "HR", "md")
    assert d.status == Status.queued and d.effective is None and "review" not in d.meta
    assert Path(d.file_path).read_bytes() == b"# New" and not old.exists()
    assert queued == [5]


@pytest.mark.parametrize(
    ("who", "status"),
    [
        (user(Role.member, "HR"), 403),
        (user(Role.manager, "Finance"), 404),  # cannot even see it
        (user(Role.admin, org_id=2), 404),
    ],
)
async def test_replace_needs_the_right_to_manage(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, who: User, status: int
) -> None:
    d = doc(tmp_path, 5, "HR", "pdf", b"%PDF-old")
    d.sha256 = "old"
    r, queued = await put(monkeypatch, tmp_path, who, d, b"# New", Session([d]))
    assert r.status_code == status and queued == [] and Path(d.file_path).exists()


async def test_replace_refuses_a_file_already_in_the_library(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    d = doc(tmp_path, 5, "HR", "pdf", b"%PDF-old")
    d.sha256 = "old"
    s = Session([d])
    s.taken = 9
    r, queued = await put(monkeypatch, tmp_path, user(Role.admin), d, b"# New", s)
    assert r.status_code == 409 and queued == []


def test_managers_do_not_manage_the_shared_managers_documents() -> None:
    hr = user(Role.manager, "HR", "Managers")
    assert access.can_manage(hr, "HR")
    assert not access.can_manage(hr, "Managers")  # readable, but only an admin changes it
    assert not access.can_manage(hr, "Everyone")
    assert access.can_manage(user(Role.admin), "Managers")
    assert not access.can_manage(user(Role.member, "HR"), "HR")
