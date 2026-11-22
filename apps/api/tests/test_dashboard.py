"""Phase 7: team rules, authorization matrix (with a fake database), insights aggregation,
super admin login. No database, no Redis."""

from collections.abc import Iterator
from datetime import UTC, date, datetime
from typing import Any

import pytest
from argon2 import PasswordHasher
from httpx import ASGITransport, AsyncClient

from atlas_api import access, super_routes
from atlas_api.insights_routes import Turn, aggregate
from atlas_api.main import app
from atlas_api.models import Department, Organization, Role, User
from atlas_api.routes import current_user, db
from atlas_api.settings import settings
from atlas_api.team_routes import review_reason


def user(role: Role, *depts: str, id: int = 1) -> User:
    return User(
        id=id,
        org_id=1,
        email=f"{role}@x.example",
        name=str(role),
        title="",
        role=role,
        org=Organization(id=1, slug="x", name="X", industry="", description=""),
        departments=[Department(name=d) for d in depts],
    )


# ------------------------------------------------------------------ rules


def test_sees_person() -> None:
    assert access.sees_person(user(Role.admin), set())
    assert access.sees_person(user(Role.manager, "HR"), {"HR", "Finance"})
    assert not access.sees_person(user(Role.manager, "HR"), {"Finance"})
    assert not access.sees_person(user(Role.member, "HR"), {"HR"})
    assert not access.sees_person(user(Role.guest), set())
    # The shared Managers department doesn't widen a manager's scope to every manager.
    hr = user(Role.manager, "HR", "Managers")
    assert access.sees_person(hr, {"HR", "Managers"})
    assert not access.sees_person(hr, {"Engineering", "Managers"})
    assert access.team_scope(hr) == {"HR"}
    assert access.team_scope(user(Role.member, "HR")) == set()


def test_can_manage_person() -> None:
    hr = user(Role.manager, "HR", "Managers")
    assert access.can_manage_person(user(Role.admin), Role.admin, {"Finance"})
    assert access.can_manage_person(hr, Role.member, {"HR"})
    assert access.can_manage_person(hr, Role.guest, {"HR"})
    assert not access.can_manage_person(hr, Role.guest, {"HR", "Managers"})  # admin-managed
    assert not access.can_manage_person(hr, Role.member, {"Managers"})
    assert not access.can_manage_person(hr, Role.manager, {"HR"})
    assert not access.can_manage_person(hr, Role.admin, {"HR"})
    assert not access.can_manage_person(hr, Role.member, {"HR", "Finance"})
    assert not access.can_manage_person(hr, Role.member, set())
    assert not access.can_manage_person(user(Role.member, "HR"), Role.member, {"HR"})


def test_role_change_and_delete_protection() -> None:
    me, other = user(Role.admin, id=1), user(Role.admin, id=2)
    assert access.role_change_error(me, me, Role.member, admins=3) == (
        "You can't change your own role."
    )
    assert access.role_change_error(me, me, Role.admin, admins=1) is None  # no change
    assert "last admin" in (access.role_change_error(me, other, Role.member, admins=1) or "")
    assert access.role_change_error(me, other, Role.member, admins=2) is None
    assert access.delete_error(me, me, admins=3) == "You can't remove yourself."
    assert "last admin" in (access.delete_error(me, other, admins=1) or "")
    assert access.delete_error(me, other, admins=2) is None
    assert access.delete_error(me, user(Role.member, id=3), admins=1) is None


def test_review_reason() -> None:
    today = date(2026, 11, 22)
    assert review_reason("31 March 2026", "01 April 2026", today) == (
        "Review date passed (31 March 2026)."
    )
    assert "12 months" in (review_reason("31 March 2027", "01 July 2025", today) or "")
    assert review_reason("31 March 2027", "01 April 2026", today) is None
    assert review_reason("On amendment", "Not applicable", today) is None
    assert review_reason(None, None, today) is None


# ------------------------------------------------------------------ authorization matrix


class Empty:
    def __iter__(self) -> Iterator[Any]:
        return iter(())

    def all(self) -> list[Any]:
        return []

    def tuples(self) -> "Empty":
        return self


class FakeSession:
    """Answers every query with nothing; `people` backs session.get(User, id)."""

    def __init__(self, people: dict[int, User] | None = None, admins: int = 1) -> None:
        self.people = people or {}
        self.admins = admins

    async def scalar(self, q: Any) -> Any:
        return self.admins if "count" in str(q) else None

    async def scalars(self, q: Any) -> Empty:
        return Empty()

    async def execute(self, *a: Any) -> Empty:
        return Empty()

    async def get(self, model: Any, id: int) -> Any:
        return self.people.get(id)

    def add(self, obj: Any) -> None:
        pass

    async def delete(self, obj: Any) -> None:
        pass

    async def commit(self) -> None:
        pass


def client(actor: User, session: FakeSession | None = None) -> AsyncClient:
    fake = session or FakeSession()
    app.dependency_overrides[current_user] = lambda: actor
    app.dependency_overrides[db] = lambda: fake
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture(autouse=True)
def _clear_overrides() -> Iterator[None]:
    yield
    app.dependency_overrides.clear()


LEADS = {Role.admin, Role.manager}
ADMIN = {Role.admin}
NEW = {"name": "N", "email": "n@x.example", "role": "member", "departments": ["HR"]}
ENDPOINTS = [
    ("GET", "/team", None, LEADS),
    ("POST", "/team", NEW, LEADS),
    ("PATCH", "/team/9", {"title": "T"}, LEADS),
    ("DELETE", "/team/9", None, LEADS),
    ("POST", "/departments", {"name": "Ops"}, ADMIN),
    ("PATCH", "/departments/HR", {"description": "d"}, ADMIN),
    ("DELETE", "/departments/HR", None, ADMIN),
    ("GET", "/access", None, LEADS),
    ("GET", "/insights?days=7", None, LEADS),
    ("GET", "/documents/review", None, LEADS),
    ("GET", "/org", None, ADMIN),
    ("PATCH", "/org", {"description": "d"}, ADMIN),
]


@pytest.mark.parametrize("role", list(Role))
@pytest.mark.parametrize(("method", "path", "body", "allowed"), ENDPOINTS)
async def test_matrix(
    role: Role, method: str, path: str, body: dict[str, Any] | None, allowed: set[Role]
) -> None:
    async with client(user(role, "HR")) as c:
        r = await c.request(method, path, json=body)
    if role in allowed:
        assert r.status_code not in (401, 403, 500), (r.status_code, r.text)
    else:
        assert r.status_code == 403, (r.status_code, r.text)


async def test_manager_cannot_create_admin_or_outside_department() -> None:
    async with client(user(Role.manager, "HR")) as c:
        assert (await c.post("/team", json=NEW | {"role": "admin"})).status_code == 403
        assert (await c.post("/team", json=NEW | {"departments": ["Finance"]})).status_code == 403


async def test_manager_cannot_touch_people_outside_or_promote() -> None:
    other = user(Role.member, "Finance", id=5)
    staff = user(Role.member, "HR", id=6)
    hr = user(Role.manager, "HR", id=1)
    async with client(hr, FakeSession({5: other, 6: staff})) as c:
        assert (await c.patch("/team/5", json={"title": "x"})).status_code == 404
        assert (await c.delete("/team/5")).status_code == 404
        assert (await c.patch("/team/6", json={"role": "manager"})).status_code == 403
        assert (await c.patch("/team/6", json={"departments": ["Finance"]})).status_code == 403
        assert (await c.patch("/team/6", json={"title": "Lead"})).status_code == 200


async def test_self_and_last_admin() -> None:
    me = user(Role.admin, id=1)
    async with client(me, FakeSession({1: me}, admins=1)) as c:
        r = await c.patch("/team/1", json={"role": "member"})
        assert r.status_code == 403 and "own role" in r.json()["detail"]
        assert (await c.delete("/team/1")).status_code == 403
        assert (await c.patch("/team/1", json={"title": "Owner"})).status_code == 200


# ------------------------------------------------------------------ insights


def turn(route: str = "rag", abstained: bool = False, **kw: Any) -> Turn:
    base: dict[str, Any] = {
        "question": "q",
        "latency_ms": 100,
        "feedback": None,
        "sources": [],
        "created_at": datetime(2026, 11, 22, 5, tzinfo=UTC),
        "departments": {"HR"},
    }
    return Turn(route=route, abstained=abstained, **(base | kw))


def test_aggregate() -> None:
    src = [{"document_id": 7, "title": "Leave Policy"}]
    turns = [
        turn(sources=src, feedback="up", latency_ms=100),
        turn(sources=src + [{"document_id": 8, "title": "Pay"}], latency_ms=300),
        turn(abstained=True, question="L4 salary?", latency_ms=200, departments={"Finance"}),
        turn(abstained=True, question="L4 salary?", latency_ms=1000, feedback="down"),
        turn(route="smalltalk", latency_ms=5, created_at=datetime(2026, 11, 21, tzinfo=UTC)),
        turn(route="blocked", latency_ms=5),
    ]
    out = aggregate(turns, [], days=3, today=date(2026, 11, 22))
    assert (out["questions"], out["answered"], out["not_found"]) == (6, 2, 2)
    assert (out["blocked"], out["smalltalk"]) == (1, 1)
    assert out["answered_pct"] == 50.0
    assert out["avg_latency_ms"] == 400  # rag turns only
    assert out["p95_latency_ms"] == 1000
    assert out["feedback"] == {"up": 1, "down": 1}
    assert out["top_unanswered"] == [{"question": "L4 salary?", "count": 2}]
    assert out["top_documents"][0] == {"document_id": 7, "title": "Leave Policy", "citations": 2}
    assert out["by_department"] == [
        {"department": "HR", "questions": 5},
        {"department": "Finance", "questions": 1},
    ]
    assert out["per_day"] == [
        {"date": "2026-11-20", "questions": 0, "not_found": 0},
        {"date": "2026-11-21", "questions": 1, "not_found": 0},
        {"date": "2026-11-22", "questions": 5, "not_found": 2},
    ]
    scoped = aggregate(turns, [], 3, date(2026, 11, 22), departments={"HR"})
    assert scoped["by_department"] == [{"department": "HR", "questions": 5}]
    empty = aggregate([], [], 1, date(2026, 11, 22))
    assert empty["answered_pct"] is None and empty["p95_latency_ms"] is None


# ------------------------------------------------------------------ super admin


class FakeRedis:
    def __init__(self) -> None:
        self.n: dict[str, int] = {}

    async def incr(self, key: str) -> int:
        self.n[key] = self.n.get(key, 0) + 1
        return self.n[key]

    async def expire(self, key: str, s: int) -> None:
        pass


@pytest.fixture
def superadmin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "superadmin_email", "sa@kanav.space")
    monkeypatch.setattr(
        settings, "superadmin_password_hash", PasswordHasher().hash("throwaway-pw-123")
    )
    monkeypatch.setattr(settings, "session_secret", "test-secret")
    monkeypatch.setattr(super_routes, "redis", FakeRedis())


def plain_client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.usefixtures("superadmin")
async def test_super_login_success_and_cookie_required() -> None:
    async with plain_client() as c:
        assert (await c.get("/super/waitlist")).status_code == 401
        r = await c.post(
            "/auth/super", json={"email": "SA@kanav.space", "password": "throwaway-pw-123"}
        )
        assert r.status_code == 204
        set_cookie = r.headers["set-cookie"]
        assert "HttpOnly" in set_cookie and "Max-Age=28800" in set_cookie
        token = set_cookie.split(";")[0].split("=", 1)[1]
        ok = await c.get("/super/waitlist", headers={"cookie": f"atlas_super={token}"})
        assert ok.status_code == 200 and ok.json() == []
        bad = await c.get("/super/waitlist", headers={"cookie": f"atlas_super={token}x"})
        assert bad.status_code == 401
    expired = super_routes.make_token(now=0)
    assert not super_routes.token_ok(expired)


@pytest.mark.usefixtures("superadmin")
async def test_super_login_fail_and_rate_limit() -> None:
    async with plain_client() as c:
        wrong = {"email": "sa@kanav.space", "password": "nope"}
        for _ in range(5):
            r = await c.post("/auth/super", json=wrong)
            assert r.status_code == 401
            assert "set-cookie" not in r.headers
        other = await c.post("/auth/super", json=wrong | {"email": "x@y.z"})
        assert other.status_code == 429
        right = {"email": "sa@kanav.space", "password": "throwaway-pw-123"}
        assert (await c.post("/auth/super", json=right)).status_code == 429


async def test_super_disabled_without_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "session_secret", "")
    monkeypatch.setattr(super_routes, "redis", FakeRedis())
    assert not super_routes.token_ok(super_routes.make_token())
    async with plain_client() as c:
        r = await c.post("/auth/super", json={"email": "a", "password": "b"})
    assert r.status_code == 401
