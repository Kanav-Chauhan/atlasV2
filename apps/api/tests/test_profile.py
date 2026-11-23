"""UI phase 8: profile picture + company logo uploads (type, size, role), serving permissions,
org settings PATCH rules, the agent audit log's pages and filters. No database, no Redis."""

import io
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

from atlas_api import profile_routes
from atlas_api.main import app
from atlas_api.models import Department, Organization, Role, User
from atlas_api.routes import current_user, db
from atlas_api.settings import settings


def org(id: int = 1, **cfg: Any) -> Organization:
    return Organization(id=id, slug=f"o{id}", name="X", industry="", description="", settings=cfg)


def user(role: Role, id: int = 1, o: Organization | None = None, avatar: str | None = None) -> User:
    o = o or org()
    return User(
        id=id,
        org_id=o.id,
        email=f"{role}{id}@x.example",
        name=str(role),
        title="",
        role=role,
        org=o,
        avatar=avatar,
        departments=[Department(name="HR")],
    )


def picture(fmt: str = "PNG", size: tuple[int, int] = (64, 40)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buf, fmt)
    return buf.getvalue()


class Rows:
    def __init__(self, rows: list[Any]) -> None:
        self.rows = rows

    def __iter__(self) -> Iterator[Any]:
        return iter(self.rows)


class FakeSession:
    def __init__(self, people: dict[int, User] | None = None, depts: set[str] | None = None):
        self.people = people or {}
        self.depts = depts or set()
        self.statements: list[str] = []
        self.commits = 0

    async def scalar(self, q: Any) -> Any:
        self.statements.append(str(q.compile(compile_kwargs={"literal_binds": True})))
        return 3 if "count" in str(q) else None

    async def scalars(self, q: Any) -> Rows:
        params = [v for v in q.compile().params.values() if isinstance(v, list)]
        wanted = params[0] if params else []
        return Rows([n for n in wanted if n in self.depts])

    async def execute(self, q: Any, *a: Any) -> Rows:
        self.statements.append(str(q.compile(compile_kwargs={"literal_binds": True})))
        return Rows([])

    async def get(self, model: Any, id: int) -> Any:
        return self.people.get(id)

    async def commit(self) -> None:
        self.commits += 1


@pytest.fixture(autouse=True)
def _files(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[Path]:
    monkeypatch.setattr(settings, "files_dir", str(tmp_path))
    yield tmp_path
    app.dependency_overrides.clear()


def client(actor: User, session: FakeSession | None = None) -> AsyncClient:
    fake = session or FakeSession()
    app.dependency_overrides[current_user] = lambda: actor
    app.dependency_overrides[db] = lambda: fake
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ------------------------------------------------------------------ validation


def test_check_image_by_magic_bytes() -> None:
    assert profile_routes.check_image(picture("PNG")) == "png"
    assert profile_routes.check_image(picture("JPEG")) == "jpeg"
    assert profile_routes.check_image(picture("WEBP")) == "webp"
    with pytest.raises(ValueError, match="PNG, JPEG and WebP"):
        profile_routes.check_image(picture("GIF"))
    with pytest.raises(ValueError, match="PNG, JPEG and WebP"):
        profile_routes.check_image(b"<svg xmlns='http://www.w3.org/2000/svg'/>")
    with pytest.raises(ValueError, match="2 MB"):
        profile_routes.check_image(b"\x89PNG\r\n\x1a\n" + b"0" * (2 * 1024 * 1024))
    with pytest.raises(ValueError, match="empty"):
        profile_routes.check_image(b"")


def test_reencode_to_square_webp() -> None:
    for mode in ("cover", "contain"):
        out = profile_routes.reencode(picture("JPEG", (300, 120)), "jpeg", mode)
        with Image.open(io.BytesIO(out)) as im:
            assert (im.format, im.size) == ("WEBP", (256, 256))
    # a PNG header on something else, a JPEG named PNG
    with pytest.raises(ValueError):
        profile_routes.reencode(b"\x89PNG\r\n\x1a\n" + b"junk" * 50, "png", "cover")
    with pytest.raises(ValueError, match="real picture"):
        profile_routes.reencode(picture("JPEG"), "png", "cover")
    with pytest.raises(ValueError, match="16 and 6,000"):
        profile_routes.reencode(picture("PNG", (8, 8)), "png", "cover")


# ------------------------------------------------------------------ uploads


async def test_avatar_upload_and_remove(_files: Path) -> None:
    me = user(Role.member, id=7)
    async with client(me) as c:
        r = await c.put("/profile/avatar", files={"file": ("a.png", picture(), "image/png")})
        assert r.status_code == 200, r.text
        assert r.json()["avatar_url"].startswith("/api/people/7/avatar?v=")
        path = _files / "o1" / "images" / "avatar-7.webp"
        assert path.read_bytes()[8:12] == b"WEBP"
        r = await c.get("/people/7/avatar")
        assert r.status_code == 200 and r.headers["content-type"] == "image/webp"
        assert r.headers["cache-control"].startswith("private")
        assert (await c.delete("/profile/avatar")).status_code == 204
        assert not path.exists() and me.avatar is None


@pytest.mark.parametrize(
    ("name", "data", "why"),
    [
        ("a.gif", picture("GIF"), "PNG, JPEG and WebP"),
        ("a.svg", b"<svg/>", "PNG, JPEG and WebP"),
        ("big.png", b"\x89PNG\r\n\x1a\n" + b"0" * (2 * 1024 * 1024 + 10), "2 MB"),
    ],
)
async def test_bad_uploads_are_422(name: str, data: bytes, why: str) -> None:
    async with client(user(Role.admin)) as c:
        for path in ("/profile/avatar", "/org/logo"):
            r = await c.put(path, files={"file": (name, data, "image/png")})
            assert r.status_code == 422 and why in r.json()["detail"]


@pytest.mark.parametrize("role", [Role.manager, Role.member, Role.guest])
async def test_logo_and_settings_are_admin_only(role: Role) -> None:
    async with client(user(role)) as c:
        r = await c.put("/org/logo", files={"file": ("l.png", picture(), "image/png")})
        assert r.status_code == 403
        assert (await c.delete("/org/logo")).status_code == 403
        assert (await c.get("/org/settings")).status_code == 403
        r = await c.patch("/org/settings", json={"notifications": {"weekly_summary": True}})
        assert r.status_code == 403
        # but everyone has a profile
        assert (await c.get("/profile")).status_code == 200
        r = await c.patch("/profile", json={"title": "Analyst"})
        assert r.status_code == 200 and r.json()["title"] == "Analyst"


async def test_logo_upload_and_serving(_files: Path) -> None:
    o = org()
    admin = user(Role.admin, o=o)
    async with client(admin) as c:
        assert (await c.get("/org/logo")).status_code == 404
        r = await c.put("/org/logo", files={"file": ("l.webp", picture("WEBP"), "image/webp")})
        assert r.status_code == 200 and r.json()["logo_url"].startswith("/api/org/logo?v=")
    async with client(user(Role.guest, id=2, o=o)) as c:  # anyone in the company sees it
        assert (await c.get("/org/logo")).status_code == 200
        assert (await c.get("/profile")).json()["org"]["logo_url"] is not None
    async with client(user(Role.admin, id=3, o=org(id=2))) as c:  # another company: own (none)
        assert (await c.get("/org/logo")).status_code == 404


async def test_avatar_only_served_inside_the_company(_files: Path) -> None:
    o = org()
    owner = user(Role.member, id=5, o=o, avatar="v1")
    path = _files / "o1" / "images" / "avatar-5.webp"
    path.parent.mkdir(parents=True)
    path.write_bytes(b"RIFF0000WEBP")
    colleague = user(Role.guest, id=6, o=o)
    outsider = user(Role.admin, id=9, o=org(id=2))
    plain = user(Role.member, id=8, o=o)
    session = FakeSession(people={5: owner, 8: plain})
    async with client(colleague, session) as c:
        assert (await c.get("/people/5/avatar")).status_code == 200
        assert (await c.get("/people/8/avatar")).status_code == 404  # no picture
        assert (await c.get("/people/404/avatar")).status_code == 404
    async with client(outsider, session) as c:
        assert (await c.get("/people/5/avatar")).status_code == 404


# ------------------------------------------------------------------ settings


async def test_settings_defaults_and_patch() -> None:
    o = org()
    session = FakeSession(depts={"HR", "Sales"})
    async with client(user(Role.admin, o=o), session) as c:
        r = await c.get("/org/settings")
        assert r.json() == {
            "access_defaults": {"role": "member", "departments": [], "guest_days": 30},
            "notifications": {"weekly_summary": False, "review_reminders": False},
            "logo_url": None,
        }
        r = await c.patch(
            "/org/settings",
            json={"access_defaults": {"role": "guest", "departments": ["Sales", "HR", "HR"]}},
        )
        assert r.status_code == 200, r.text
        assert r.json()["access_defaults"] == {
            "role": "guest",
            "departments": ["HR", "Sales"],
            "guest_days": 30,
        }
        r = await c.patch("/org/settings", json={"notifications": {"review_reminders": True}})
        assert r.json()["notifications"] == {"weekly_summary": False, "review_reminders": True}
        assert r.json()["access_defaults"]["role"] == "guest"  # untouched
        assert profile_routes.access_defaults(o)["departments"] == ["HR", "Sales"]


@pytest.mark.parametrize(
    "body",
    [
        {"access_defaults": {"role": "admin"}},
        {"access_defaults": {"guest_days": 0}},
        {"access_defaults": {"guest_days": 400}},
        {"access_defaults": {"departments": ["Nope"]}},
        {"notifications": {"weekly_summary": "maybe"}},
    ],
)
async def test_settings_patch_rejects(body: dict[str, Any]) -> None:
    async with client(user(Role.admin), FakeSession(depts={"HR"})) as c:
        assert (await c.patch("/org/settings", json=body)).status_code == 422


async def test_profile_name_rules() -> None:
    async with client(user(Role.member)) as c:
        assert (await c.patch("/profile", json={"name": "   "})).status_code == 422
        r = await c.patch("/profile", json={"name": " Asha Rao "})
        assert r.json()["name"] == "Asha Rao" and r.json()["role"] == "member"


# ------------------------------------------------------------------ agent audit pages


async def test_audit_pages_and_filters() -> None:
    session = FakeSession()
    async with client(user(Role.admin), session) as c:
        r = await c.get("/tokens/audit?page=3&per_page=10&token=4&tool=ask_question&days=30")
        assert r.status_code == 200, r.text
        body = r.json()
        assert (body["total"], body["page"], body["per_page"]) == (3, 3, 10)
        assert "ask_question" in body["tools"] and body["items"] == []
        count, rows = session.statements
        for sql in (count, rows):
            assert "mcp_audit.token_id = 4" in sql and "mcp_audit.tool = 'ask_question'" in sql
        assert "LIMIT 10" in rows and "OFFSET 20" in rows
        assert (await c.get("/tokens/audit?per_page=500")).status_code == 422
        assert (await c.get("/tokens/audit?page=0")).status_code == 422
    async with client(user(Role.manager)) as c:
        assert (await c.get("/tokens/audit")).status_code == 403
