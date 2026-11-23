"""UI phase 5: Team for big companies. Unit tests (rules, CSV checks, bulk planning, auto-join
rules) need nothing; the `integration` ones run the real SQL on Postgres (paging, filters,
manager scope, groups, bulk, import, auto-join on sign-in)."""

from collections.abc import AsyncIterator, Iterator
from datetime import UTC, date, datetime
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from atlas_api import clerk, plans, team_routes
from atlas_api.db import Session, SyncSession
from atlas_api.main import app
from atlas_api.models import Department, Organization, Role, User
from atlas_api.routes import DB, current_user, db
from atlas_api.settings import settings
from atlas_api.team_routes import BulkIn, ImportRowIn, bulk_change, check_rows, parse_csv


def person(role: Role, *depts: str, id: int = 1, email: str = "") -> User:
    return User(
        id=id,
        org_id=1,
        email=email or f"{role}{id}@acme.example",
        name=f"{role} {id}",
        title="",
        role=role,
        departments=[Department(org_id=1, name=d) for d in depts],
    )


# ------------------------------------------------------------------ unit: helpers


def test_status_of() -> None:
    today = date(2026, 11, 24)
    u = person(Role.guest)
    assert team_routes.status_of(u, today) == "invited"
    u.last_active = datetime(2026, 11, 1, tzinfo=UTC)
    assert team_routes.status_of(u, today) == "active"
    u.guest_until = date(2026, 11, 1)
    assert team_routes.status_of(u, today) == "expired"
    m = person(Role.member)
    m.guest_until = date(2020, 1, 1)  # only guests expire
    assert team_routes.status_of(m, today) == "invited"


def test_name_from_email() -> None:
    assert team_routes.name_from_email("neha.gupta@acme.example") == "Neha Gupta"
    assert team_routes.name_from_email("ravi_k+atlas@acme.example") == "Ravi K"


def test_like_escapes_wildcards() -> None:
    assert team_routes.like("50%_a") == "%50\\%\\_a%"


# ------------------------------------------------------------------ unit: bulk planning

ENG = {"Engineering": Department(org_id=1, name="Engineering")}


def test_bulk_never_demotes_the_last_admin() -> None:
    me = person(Role.admin, id=1)
    a2, a3 = person(Role.admin, id=2), person(Role.admin, id=3)
    plan, errors = bulk_change(me, [a2, a3], BulkIn(ids=[2, 3], role=Role.member), ENG, 3)
    # 3 admins: demoting 2 leaves me; both allowed.
    assert [u.id for u, _, _ in plan] == [2, 3] and errors == []
    plan, errors = bulk_change(me, [a2, a3], BulkIn(ids=[2, 3], role=Role.member), ENG, 2)
    assert [u.id for u, _, _ in plan] == [2]
    assert errors[0].id == 3 and "last admin" in errors[0].error


def test_bulk_skips_myself() -> None:
    me = person(Role.admin, id=1)
    plan, errors = bulk_change(me, [me], BulkIn(ids=[1], role=Role.member), ENG, 5)
    assert plan == [] and "own role" in errors[0].error


def test_bulk_manager_scope() -> None:
    hr = person(Role.manager, "HR", "Managers", id=1)
    staff = person(Role.member, "HR", id=2)
    mixed = person(Role.member, "HR", "Finance", id=3)
    peer = person(Role.manager, "HR", id=4)
    groups = {"HR": Department(name="HR"), "Finance": Department(name="Finance")}
    # role: guest is fine for own members; promotion to manager is not
    plan, errors = bulk_change(
        hr, [staff, mixed, peer], BulkIn(ids=[2], role=Role.guest), groups, 1
    )
    assert [u.id for u, _, _ in plan] == [2]
    assert {e.id for e in errors} == {3, 4}
    plan, errors = bulk_change(hr, [staff], BulkIn(ids=[2], role=Role.manager), groups, 1)
    assert plan == [] and errors[0].error == team_routes.SCOPE_ERROR
    # groups: can't add someone to a group outside scope, can't leave them in no group
    plan, errors = bulk_change(hr, [staff], BulkIn(ids=[2], add_group="Finance"), groups, 1)
    assert plan == [] and errors
    plan, errors = bulk_change(hr, [staff], BulkIn(ids=[2], remove_group="HR"), groups, 1)
    assert plan == [] and errors


def test_bulk_add_and_remove_group() -> None:
    me = person(Role.admin, id=1)
    u = person(Role.member, "HR", id=2)
    plan, _ = bulk_change(me, [u], BulkIn(ids=[2], add_group="Engineering"), ENG, 1)
    assert {d.name for d in plan[0][2]} == {"HR", "Engineering"}
    plan, _ = bulk_change(me, [u], BulkIn(ids=[2], remove_group="HR"), ENG, 1)
    assert plan[0][2] == []


# ------------------------------------------------------------------ unit: CSV


def test_parse_csv_header_bom_blank_lines() -> None:
    raw = "﻿Email,Name,Role,Groups\na@acme.example,A,member,HR; Finance\n,,,\n\nb@acme.example,,,\n"
    rows = parse_csv(raw)
    assert [(line, r.email, r.groups) for line, r in rows] == [
        (2, "a@acme.example", "HR; Finance"),
        (5, "b@acme.example", ""),
    ]


def test_parse_csv_needs_email_column_and_row_cap() -> None:
    with pytest.raises(Exception, match="first line"):
        parse_csv("name,role\nA,member\n")
    big = "email\n" + "".join(f"p{i}@acme.example\n" for i in range(501))
    with pytest.raises(Exception, match="500"):
        parse_csv(big)


def rows(*items: dict[str, str]) -> list[tuple[int, ImportRowIn]]:
    return [(i + 2, ImportRowIn(**r)) for i, r in enumerate(items)]


def test_check_rows_validation() -> None:
    admin = person(Role.admin)
    out = check_rows(
        admin,
        rows(
            {"email": "ok@acme.example", "groups": "hr|Everyone"},
            {"email": "not-an-email"},
            {"email": "OK@acme.example"},
            {"email": "taken@acme.example"},
            {"email": "r@acme.example", "role": "owner"},
            {"email": "g@acme.example", "groups": "Nope"},
            {"email": "boss@acme.example", "role": "Admin", "name": "Big Boss"},
        ),
        ["HR", "Finance"],
        {"taken@acme.example"},
    )
    assert out[0].error is None and out[0].groups == ["HR"] and out[0].role == "member"
    assert out[0].name == "Ok"
    assert [r.error for r in out[1:]] == [
        "Not an email address.",
        "This email is in the file twice.",
        "Already in Atlas.",
        "Role must be admin, manager, member or guest.",
        "There is no group called Nope.",
        None,
    ]
    assert out[-1].role == "admin" and out[-1].name == "Big Boss"


def test_check_rows_manager_scope() -> None:
    hr = person(Role.manager, "HR", "Managers")
    out = check_rows(
        hr,
        rows(
            {"email": "a@acme.example", "groups": "HR"},
            {"email": "b@acme.example", "groups": "Finance"},
            {"email": "c@acme.example", "role": "manager", "groups": "HR"},
            {"email": "d@acme.example"},  # no group: outside a manager's scope
        ),
        ["HR", "Finance", "Managers"],
        set(),
    )
    assert out[0].error is None
    assert all(r.error and "your own groups" in r.error for r in out[1:])


# ------------------------------------------------------------------ unit: auto-join rules


@pytest.mark.parametrize(
    ("domain", "ok"),
    [
        ("acme.com", True),
        ("mail.acme.co.in", True),
        ("gmail.com", False),
        ("outlook.com", False),
        ("yahoo.com", False),
        ("hotmail.com", False),
        ("icloud.com", False),
        ("proton.me", False),
        ("acme", False),
        ("-acme.com", False),
        ("acme..com", False),
    ],
)
def test_domain_error(domain: str, ok: bool) -> None:
    assert (clerk.domain_error(domain) is None) is ok


def test_auto_join_config_defaults_and_never_lead_roles() -> None:
    assert clerk.auto_join_config(Organization(auto_join={})) == {
        "domains": [],
        "role": "member",
        "departments": [],
    }
    conf = clerk.auto_join_config(Organization(auto_join={"domains": ["a.com"], "role": "admin"}))
    assert conf["role"] == "member"


async def test_unverified_email_never_auto_joins(monkeypatch: pytest.MonkeyPatch) -> None:
    """resolve() stops before any lookup when Clerk hasn't verified the primary email."""

    async def fake_get_user(_: str) -> dict[str, Any]:
        return {
            "primary_email_address_id": "e1",
            "email_addresses": [
                {
                    "id": "e1",
                    "email_address": "new@acme.example",
                    "verification": {"status": "unverified"},
                }
            ],
        }

    async def never(*_: Any) -> None:
        raise AssertionError("must not look anyone up")

    class NoUser:
        async def scalar(self, _: Any) -> None:
            return None

    monkeypatch.setattr(settings, "clerk_secret_key", "sk_test_x")
    monkeypatch.setattr(clerk, "get_user", fake_get_user)
    monkeypatch.setattr(clerk, "link_by_email", never)
    monkeypatch.setattr(clerk, "auto_join", never)
    assert await clerk.resolve(NoUser(), "user_x") is None  # type: ignore[arg-type]


# ------------------------------------------------------------------ unit: endpoint rules


class Empty:
    def __iter__(self) -> Iterator[Any]:
        return iter(())


class FakeSession:
    async def scalar(self, q: Any) -> Any:
        return 1 if "count" in str(q) else None

    async def scalars(self, q: Any) -> Empty:
        return Empty()

    async def execute(self, *a: Any) -> Empty:
        return Empty()

    async def get(self, model: Any, id: int) -> Any:
        return (
            Organization(id=1, slug="acme", plan="pro", auto_join={})
            if model is Organization
            else None
        )

    async def commit(self) -> None:
        pass


@pytest.fixture
def as_role() -> Iterator[Any]:
    def use(actor: User) -> AsyncClient:
        app.dependency_overrides[current_user] = lambda: actor
        app.dependency_overrides[db] = lambda: FakeSession()
        return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    yield use
    app.dependency_overrides.clear()


@pytest.mark.parametrize("role", list(Role))
@pytest.mark.parametrize(
    ("method", "path", "body", "admin_only"),
    [
        (
            "GET",
            "/team/people?q=a&role=member&dept=HR&status=active&page=2&per_page=25",
            None,
            False,
        ),
        ("GET", "/team/groups", None, False),
        ("POST", "/team/bulk", {"ids": [5], "role": "guest"}, False),
        ("POST", "/team/import", {"csv": "email\na@acme.example\n"}, False),
        ("GET", "/org/auto-join", None, True),
        ("PATCH", "/org/auto-join", {"role": "member"}, True),
    ],
)
async def test_new_endpoints_matrix(
    as_role: Any, role: Role, method: str, path: str, body: Any, admin_only: bool
) -> None:
    actor = person(role, "HR")
    actor.org = Organization(id=1, slug="acme", name="Acme", plan="pro", auto_join={})
    async with as_role(actor) as c:
        r = await c.request(method, path, json=body)
    allowed = role == Role.admin or (role == Role.manager and not admin_only)
    if allowed:
        assert r.status_code not in (401, 403, 422, 500), (r.status_code, r.text)
    else:
        assert r.status_code == 403, (r.status_code, r.text)


async def test_paging_limits_and_bulk_shape(as_role: Any) -> None:
    async with as_role(person(Role.admin)) as c:
        assert (await c.get("/team/people?per_page=101")).status_code == 422
        assert (await c.get("/team/people?page=0")).status_code == 422
        assert (await c.get("/team/people?role=owner")).status_code == 422
        r = await c.post("/team/bulk", json={"ids": [2], "role": "guest", "add_group": "HR"})
        assert r.status_code == 400
        assert (await c.post("/team/bulk", json={"ids": [], "role": "guest"})).status_code == 422
        many = {"ids": list(range(501)), "role": "guest"}
        assert (await c.post("/team/bulk", json=many)).status_code == 422


# ------------------------------------------------------------------ integration (Postgres)

PRO, DEMO, OTHER = "zz-team-pro", "zz-team-demo", "zz-team-other"
DOMAIN = "zz-team.example"


def cleanup() -> None:
    with SyncSession() as s:
        s.execute(delete(Organization).where(Organization.slug.in_((PRO, DEMO, OTHER))))
        s.execute(delete(User).where(User.email.like(f"%@{DOMAIN}")))
        s.commit()


@pytest.fixture
def world() -> Iterator[dict[str, int]]:
    """A Pro company with 60 people: 2 admins, 2 managers (HR, Engineering), 50 Engineering
    members, 5 HR members, 1 guest; plus a demo company and another Pro company."""
    cleanup()
    ids: dict[str, int] = {}
    with SyncSession() as s:
        pro = Organization(slug=PRO, name="Pro", plan="pro", website_chat={}, auto_join={})
        demo = Organization(slug=DEMO, name="Demo", plan="demo", website_chat={}, auto_join={})
        other = Organization(slug=OTHER, name="Other", plan="pro", website_chat={}, auto_join={})
        s.add_all([pro, demo, other])
        s.flush()
        eng, hr, mgrs = (
            Department(org_id=pro.id, name=n) for n in ("Engineering", "HR", "Managers")
        )
        s.add_all([eng, hr, mgrs, Department(org_id=demo.id, name="HR")])
        s.flush()

        def add(email: str, role: Role, *depts: Department, **kw: Any) -> User:
            u = User(
                org_id=pro.id,
                email=email,
                name=email.split("@")[0],
                role=role,
                departments=list(depts),
                **kw,
            )
            s.add(u)
            return u

        a1 = add(f"admin1@{DOMAIN}", Role.admin)
        add(f"admin2@{DOMAIN}", Role.admin)
        m_hr = add(f"mgr-hr@{DOMAIN}", Role.manager, hr, mgrs)
        add(f"mgr-eng@{DOMAIN}", Role.manager, eng, mgrs)
        for i in range(50):
            add(
                f"dev{i:02d}@{DOMAIN}",
                Role.member,
                eng,
                title="Developer",
                last_active=datetime(2026, 11, 1, tzinfo=UTC) if i % 2 else None,
            )
        for i in range(5):
            add(f"hr{i}@{DOMAIN}", Role.member, hr)
        add(f"guest@{DOMAIN}", Role.guest, guest_until=date(2020, 1, 1))
        s.add(User(org_id=demo.id, email=f"demo-admin@{DOMAIN}", name="D", role=Role.admin))
        s.commit()
        ids = {"pro": pro.id, "demo": demo.id, "other": other.id, "admin": a1.id, "mgr_hr": m_hr.id}
    yield ids
    cleanup()


def as_user(user_id: int) -> AsyncClient:
    async def load(s: DB) -> User:
        u = await s.get(User, user_id)
        assert u is not None
        return u

    app.dependency_overrides[current_user] = load
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
async def clear() -> AsyncIterator[None]:
    yield
    app.dependency_overrides.clear()


@pytest.mark.integration
async def test_directory_pages_filters_and_scope(world: dict[str, int], clear: None) -> None:
    async with as_user(world["admin"]) as c:
        r = (await c.get("/team/people")).json()
        assert r["total"] == 60 and len(r["people"]) == 25 and r["per_page"] == 25
        last = (await c.get("/team/people?page=3")).json()
        assert len(last["people"]) == 10
        names = [
            p["name"]
            for p in r["people"]
            + (await c.get("/team/people?page=2")).json()["people"]
            + last["people"]
        ]
        assert len(set(names)) == 60 and names == sorted(names, key=str.lower)
        assert (await c.get("/team/people?dept=Engineering")).json()["total"] == 51
        assert (await c.get("/team/people?dept=Everyone")).json()["total"] == 60
        assert (await c.get("/team/people?dept=-")).json()["total"] == 3  # 2 admins + guest
        assert (await c.get("/team/people?role=manager")).json()["total"] == 2
        assert (await c.get("/team/people?q=DEV1")).json()["total"] == 10
        assert (await c.get("/team/people?q=developer")).json()["total"] == 50  # title
        assert (await c.get("/team/people?q=%25")).json()["total"] == 0  # % is literal
        assert (await c.get("/team/people?status=expired")).json()["total"] == 1
        assert (await c.get("/team/people?status=active&dept=Engineering")).json()["total"] == 25
    async with as_user(world["mgr_hr"]) as c:
        r = (await c.get("/team/people?per_page=100")).json()
        # HR manager: HR people (5 members + themselves), never Engineering or other managers.
        assert r["total"] == 6
        assert all("HR" in p["departments"] for p in r["people"])
        assert (await c.get("/team/people?dept=Engineering")).json()["total"] == 0


@pytest.mark.integration
async def test_groups_counts_and_manager_view(world: dict[str, int], clear: None) -> None:
    async with as_user(world["admin"]) as c:
        g = (await c.get("/team/groups")).json()
    assert g["total"] == 60 and g["no_group"] == 3
    assert g["roles"] == {"admin": 2, "manager": 2, "member": 55, "guest": 1}
    eng = next(x for x in g["groups"] if x["name"] == "Engineering")
    assert (
        eng["people"] == 51
        and eng["managers"] == ["mgr-eng"]
        and eng["reads"] == ["Engineering", "Everyone"]
    )
    async with as_user(world["mgr_hr"]) as c:
        g = (await c.get("/team/groups")).json()
    assert [x["name"] for x in g["groups"]] == ["HR"] and g["total"] == 6


@pytest.mark.integration
async def test_bulk_endpoint(world: dict[str, int], clear: None) -> None:
    async with Session() as s:
        devs = list(await s.scalars(select(User.id).where(User.email.like(f"dev0%@{DOMAIN}"))))
        admins = list(
            await s.scalars(
                select(User.id).where(User.org_id == world["pro"], User.role == Role.admin)
            )
        )
    async with as_user(world["admin"]) as c:
        r = (await c.post("/team/bulk", json={"ids": devs, "add_group": "HR"})).json()
        assert r == {"changed": 10, "errors": []}
        assert (await c.get("/team/people?dept=HR")).json()["total"] == 16
        # demote both admins: I can't change myself, the other goes (2 admins → 1 left)
        r = (await c.post("/team/bulk", json={"ids": admins, "role": "member"})).json()
        assert r["changed"] == 1 and "own role" in r["errors"][0]["error"]
    async with as_user(world["mgr_hr"]) as c:
        # devs are now in HR + Engineering: outside the HR manager's scope
        r = (await c.post("/team/bulk", json={"ids": devs[:2] + [999999], "role": "guest"})).json()
        assert r["changed"] == 0 and len(r["errors"]) == 3


@pytest.mark.integration
async def test_import_dry_run_then_apply(
    world: dict[str, int], clear: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent: list[str] = []

    async def fake_invite(email: str) -> str:
        sent.append(email)
        return "sent"

    monkeypatch.setattr(clerk, "invite", fake_invite)
    monkeypatch.setattr(settings, "clerk_secret_key", "sk_test_x")
    csv = (
        "email,name,title,role,groups\n"
        f"new1@{DOMAIN},New One,Analyst,member,HR\n"
        f"new2@{DOMAIN},,,guest,\n"
        f"dev00@{DOMAIN},Dup,,member,\n"
        f"bad@{DOMAIN},X,,member,Nope\n"
    )
    async with as_user(world["admin"]) as c:
        dry = (await c.post("/team/import", json={"csv": csv})).json()
        assert (dry["valid"], dry["invalid"], dry["created"]) == (2, 2, 0)
        assert (await c.get("/team/people")).json()["total"] == 60
        done = (await c.post("/team/import", json={"csv": csv, "dry_run": False})).json()
        assert done["created"] == 2
        assert (await c.get("/team/people")).json()["total"] == 62
        got = (await c.get("/team/people?q=new1")).json()["people"][0]
        assert (got["name"], got["title"], got["departments"]) == ("New One", "Analyst", ["HR"])
    assert sorted(sent) == [f"new1@{DOMAIN}", f"new2@{DOMAIN}"]


@pytest.mark.integration
@pytest.mark.limits
async def test_import_respects_plan_people_cap(world: dict[str, int], clear: None) -> None:
    """Pro has room for 25 people; this company already has 60, so nothing is added."""
    async with as_user(world["admin"]) as c:
        r = (
            await c.post("/team/import", json={"csv": f"email\nx@{DOMAIN}\n", "dry_run": False})
        ).json()
    assert r["created"] == 0 and "room for" in r["rows"][0]["error"]
    assert plans.limits(Organization(plan="pro")).people == 25


@pytest.mark.integration
async def test_auto_join_settings_rules(world: dict[str, int], clear: None) -> None:
    async with as_user(world["admin"]) as c:
        assert (await c.get("/org/auto-join")).json()["allowed_domains"] == [DOMAIN]
        assert (await c.patch("/org/auto-join", json={"domains": ["gmail.com"]})).status_code == 400
        assert (await c.patch("/org/auto-join", json={"domains": ["acme.com"]})).status_code == 403
        assert (await c.patch("/org/auto-join", json={"role": "admin"})).status_code == 400
        assert (
            await c.patch("/org/auto-join", json={"departments": ["Managers"]})
        ).status_code == 400
        r = await c.patch(
            "/org/auto-join", json={"domains": [f"@{DOMAIN.upper()}"], "departments": ["HR"]}
        )
        assert r.status_code == 200, r.text
        assert r.json() | {"allowed_domains": []} == {
            "domains": [DOMAIN],
            "role": "member",
            "departments": ["HR"],
            "available": True,
            "allowed_domains": [],
        }
    async with as_user(world["mgr_hr"]) as c:
        assert (await c.get("/org/auto-join")).status_code == 403
    # another company can't claim the same domain
    with SyncSession() as s:
        other_admin = User(org_id=world["other"], email=f"boss@{DOMAIN}", name="B", role=Role.admin)
        s.add(other_admin)
        s.commit()
        oid = other_admin.id
    async with as_user(oid) as c:
        assert (await c.patch("/org/auto-join", json={"domains": [DOMAIN]})).status_code == 409
    async with Session() as s:
        demo_admin = await s.scalar(select(User.id).where(User.email == f"demo-admin@{DOMAIN}"))
    async with as_user(demo_admin or 0) as c:
        assert (await c.patch("/org/auto-join", json={"role": "member"})).status_code == 403


@pytest.mark.integration
async def test_auto_join_on_sign_in(world: dict[str, int], monkeypatch: pytest.MonkeyPatch) -> None:
    with SyncSession() as s:
        pro = s.get(Organization, world["pro"])
        demo = s.get(Organization, world["demo"])
        assert pro and demo
        pro.auto_join = {"domains": [DOMAIN], "role": "guest", "departments": ["HR"]}
        demo.auto_join = {"domains": ["zz-demo.example"]}  # stored by hand; must never apply
        s.commit()
    monkeypatch.setattr(settings, "clerk_secret_key", "sk_test_x")
    users = {
        "user_new": (f"fresh.person@{DOMAIN}", "verified"),
        "user_unv": (f"unverified@{DOMAIN}", "unverified"),
        "user_demo": ("someone@zz-demo.example", "verified"),
        "user_gmail": ("someone@gmail.com", "verified"),
    }

    async def fake_get_user(sub: str) -> dict[str, Any]:
        email, status = users[sub]
        return {
            "first_name": "Fresh",
            "last_name": "Person",
            "primary_email_address_id": "e",
            "email_addresses": [
                {"id": "e", "email_address": email, "verification": {"status": status}}
            ],
        }

    monkeypatch.setattr(clerk, "get_user", fake_get_user)
    async with Session() as a:
        u = await clerk.resolve(a, "user_new")
        assert u is not None and u.org_id == world["pro"]
        assert (u.role, u.department_names, u.name) == (Role.guest, {"HR"}, "Fresh Person")
        again = await clerk.resolve(a, "user_new")
        assert again is not None and again.id == u.id  # linked now, not made twice
        assert await clerk.resolve(a, "user_unv") is None
        assert await clerk.resolve(a, "user_demo") is None
        assert await clerk.resolve(a, "user_gmail") is None
