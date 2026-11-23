"""Real sign-in (clerk.py, signup_routes.py): Clerk session JWT checks, the demo cookie limited to
demo companies, linking by verified email only, onboarding once, invitations on Team & access.
Unit tests need nothing; the integration tests need Postgres (CI service)."""

import asyncio
import base64
import json
import time
from collections.abc import Iterator
from typing import Any

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from atlas_api import clerk, team_routes
from atlas_api.db import Session, SyncSession
from atlas_api.main import app
from atlas_api.models import Department, Organization, Role, User
from atlas_api.settings import settings

HOST = "clerk.atlas-test.example"
PK = "pk_test_" + base64.b64encode(f"{HOST}$".encode()).decode().rstrip("=")
ISS = f"https://{HOST}"
P10 = "https://p10.kanav.space"

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def token(sub: str = "user_abc", key: Any = KEY, **over: Any) -> str:
    now = int(time.time())
    claims = {"sub": sub, "iss": ISS, "azp": P10, "iat": now, "nbf": now, "exp": now + 60}
    claims.update(over)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "ins_test"})


@pytest.fixture(autouse=True)
def clerk_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "clerk_publishable_key", PK)
    monkeypatch.setattr(settings, "app_origin", P10)
    monkeypatch.setattr(clerk, "signing_key", lambda _t, iss: KEY.public_key())


# ------------------------------------------------------------------ JWT checks (unit)


def test_frontend_api_from_publishable_key() -> None:
    assert clerk.frontend_api(PK) == HOST
    assert clerk.issuer() == ISS
    assert clerk.frontend_api("pk_live_bm90LWEtaG9zdA") is None  # no trailing $
    assert clerk.frontend_api("garbage") is None


async def test_valid_token_is_accepted() -> None:
    claims = await clerk.verify(token())
    assert claims is not None and claims["sub"] == "user_abc"


@pytest.mark.parametrize(
    "bad",
    [
        pytest.param(lambda: token(key=OTHER_KEY), id="forged-signature"),
        pytest.param(lambda: token(exp=int(time.time()) - 60), id="expired"),
        pytest.param(lambda: token(nbf=int(time.time()) + 600), id="not-yet-valid"),
        pytest.param(lambda: token(azp="https://evil.example"), id="wrong-azp"),
        pytest.param(lambda: token(azp=None), id="no-azp"),
        pytest.param(lambda: token(iss="https://clerk.evil.example"), id="wrong-issuer"),
        pytest.param(lambda: token(sub="org_123"), id="not-a-user"),
        pytest.param(lambda: token() + "x", id="tampered"),
        pytest.param(lambda: "not.a.jwt", id="garbage"),
    ],
)
async def test_bad_tokens_are_rejected(bad: Any) -> None:
    assert await clerk.verify(bad()) is None


async def test_alg_confusion_and_none_are_rejected() -> None:
    now = int(time.time())
    claims = {"sub": "user_abc", "iss": ISS, "azp": P10, "iat": now, "exp": now + 60}
    pem = KEY.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    hs = jwt.encode(claims, base64.b64encode(pem).decode(), algorithm="HS256")
    unsigned = jwt.encode(claims, "", algorithm="none")
    assert await clerk.verify(hs) is None
    assert await clerk.verify(unsigned) is None


async def test_no_publishable_key_means_no_clerk(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "clerk_publishable_key", "")
    assert await clerk.verify(token()) is None


def test_only_a_verified_primary_email_counts() -> None:
    def cu(*emails: tuple[str, str, str]) -> dict[str, Any]:
        return {
            "primary_email_address_id": "idn_1",
            "email_addresses": [
                {"id": i, "email_address": a, "verification": {"status": st}} for i, a, st in emails
            ],
        }

    assert clerk.verified_primary_email(cu(("idn_1", "Riya@X.io", "verified"))) == "riya@x.io"
    assert clerk.verified_primary_email(cu(("idn_1", "riya@x.io", "unverified"))) is None
    # A verified secondary address is not enough.
    assert (
        clerk.verified_primary_email(
            cu(("idn_1", "a@x.io", "unverified"), ("idn_2", "b@x.io", "verified"))
        )
        is None
    )


async def test_no_session_is_401() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        assert (await c.get("/onboarding")).status_code == 401
        r = await c.get("/onboarding", headers={"authorization": f"Bearer {token(key=OTHER_KEY)}"})
        assert r.status_code == 401


# ------------------------------------------------------------------ with Postgres (integration)

DEMO_SLUG, PRO_SLUG = "zz-clerk-demo", "zz-clerk-pro"
DEMO_EMAIL, PRO_EMAIL = "demo-person@zz-clerk.example", "invited@zz-clerk.example"
NEW_EMAIL = "founder@zz-clerk.example"


def clerk_user(email: str, status: str = "verified") -> dict[str, Any]:
    return {
        "first_name": "Riya",
        "last_name": "Shah",
        "primary_email_address_id": "idn_1",
        "email_addresses": [
            {"id": "idn_1", "email_address": email, "verification": {"status": status}}
        ],
    }


@pytest.fixture
def world(monkeypatch: pytest.MonkeyPatch) -> Iterator[dict[str, Any]]:
    """A demo company and a Pro company with one not-yet-linked person; fake Clerk users."""
    users: dict[str, dict[str, Any]] = {}

    async def fake_get_user(sub: str) -> dict[str, Any]:
        return users[sub]

    monkeypatch.setattr(clerk, "get_user", fake_get_user)
    monkeypatch.setattr(settings, "clerk_secret_key", "sk_test_x")

    def cleanup() -> None:
        with SyncSession() as s:
            emails = (DEMO_EMAIL, PRO_EMAIL, NEW_EMAIL, "added@zz-clerk.example")
            org_ids = s.scalars(select(User.org_id).where(User.email.in_(emails))).all()
            s.execute(delete(Organization).where(Organization.id.in_(org_ids)))
            s.execute(delete(Organization).where(Organization.slug.in_((DEMO_SLUG, PRO_SLUG))))
            s.commit()

    cleanup()
    with SyncSession() as s:
        demo = Organization(slug=DEMO_SLUG, name="Demo Co", plan="demo", website_chat={})
        pro = Organization(slug=PRO_SLUG, name="Pro Co", plan="pro", website_chat={})
        s.add_all([demo, pro])
        s.flush()
        s.add(Department(org_id=pro.id, name="HR"))
        s.add(User(org_id=demo.id, email=DEMO_EMAIL, name="Demo", role=Role.admin))
        s.add(User(org_id=pro.id, email=PRO_EMAIL, name="Invited", role=Role.member))
        s.commit()
    yield {"users": users}
    cleanup()


def client(**cookies: str) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=cookies)


def bearer(sub: str) -> dict[str, str]:
    return {"authorization": f"Bearer {token(sub)}"}


@pytest.mark.integration
async def test_demo_cookie_only_for_demo_companies(world: dict[str, Any]) -> None:
    async with client(atlas_demo_user=DEMO_EMAIL) as c:
        r = await c.get("/me")
    assert r.status_code == 200 and r.json()["auth"] == "demo"
    # Next's cookies().set() sends the value URL-encoded.
    async with client(atlas_demo_user=DEMO_EMAIL.replace("@", "%40")) as c:
        assert (await c.get("/me")).status_code == 200
    # The same plain cookie naming a real company's person must not log anyone in.
    async with client(atlas_demo_user=PRO_EMAIL) as c:
        assert (await c.get("/me")).status_code == 401


@pytest.mark.integration
async def test_invited_person_links_by_verified_email(world: dict[str, Any]) -> None:
    world["users"]["user_unverified"] = clerk_user(PRO_EMAIL, status="unverified")
    world["users"]["user_inv"] = clerk_user(PRO_EMAIL.upper())
    async with client() as c:
        assert (await c.get("/me", headers=bearer("user_unverified"))).status_code == 401
        r = await c.get("/me", headers=bearer("user_inv"))
        assert r.status_code == 200, r.text
        assert r.json()["email"] == PRO_EMAIL and r.json()["auth"] == "clerk"
        # The __session cookie works the same way as the Bearer header.
        c.cookies.set("__session", token("user_inv"))
        assert (await c.get("/me")).json()["org"]["slug"] == PRO_SLUG
    async with Session() as s:
        u = await s.scalar(select(User).where(User.email == PRO_EMAIL))
        assert u is not None and u.clerk_user_id == "user_inv"
    # Linked now: the demo cookie with this email still does nothing.
    async with client(atlas_demo_user=PRO_EMAIL) as c:
        assert (await c.get("/me")).status_code == 401


@pytest.mark.integration
async def test_clerk_user_never_links_to_a_demo_person(world: dict[str, Any]) -> None:
    world["users"]["user_d"] = clerk_user(DEMO_EMAIL)
    async with client() as c:
        assert (await c.get("/me", headers=bearer("user_d"))).status_code == 401
        r = await c.get("/onboarding", headers=bearer("user_d"))
        assert r.json()["linked"] is False
        r = await c.post("/onboarding", headers=bearer("user_d"), json={"company": "Sneaky"})
        assert r.status_code == 409


@pytest.mark.integration
async def test_onboarding_creates_company_and_admin_once(world: dict[str, Any]) -> None:
    world["users"]["user_new"] = clerk_user(NEW_EMAIL)
    body = {"company": "Acme Tools Pvt Ltd", "industry": "Manufacturing"}
    async with client() as c:
        h = bearer("user_new")
        assert (await c.get("/me", headers=h)).status_code == 401
        state = (await c.get("/onboarding", headers=h)).json()
        assert state == {"linked": False, "email": NEW_EMAIL, "name": "Riya Shah", "org": None}
        # Double submit at once, then once more: one company, one admin.
        first, second = await asyncio.gather(
            c.post("/onboarding", headers=h, json=body),
            c.post("/onboarding", headers=bearer("user_new"), json=body),
        )
        third = await c.post("/onboarding", headers=h, json={"company": "Other name"})
        assert {first.status_code, second.status_code, third.status_code} == {200}
        slugs = {r.json()["org"] for r in (first, second, third)}
        assert len(slugs) == 1
        me = (await c.get("/me", headers=h)).json()
    assert me["role"] == "admin" and me["plan"] == "pro" and me["org"]["name"] == body["company"]
    async with Session() as s:
        orgs = (await s.scalars(select(Organization).where(Organization.slug.in_(slugs)))).all()
        assert len(orgs) == 1 and orgs[0].industry == "Manufacturing"
        n = (await s.scalars(select(User).where(User.org_id == orgs[0].id))).all()
        assert [u.email for u in n] == [NEW_EMAIL]


@pytest.mark.integration
async def test_adding_a_person_sends_an_invite_for_real_companies_only(
    world: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    sent: list[str] = []

    async def fake_invite(email: str) -> str:
        sent.append(email)
        return "sent"

    monkeypatch.setattr(clerk, "invite", fake_invite)
    world["users"]["user_inv"] = clerk_user(PRO_EMAIL)
    async with client() as c:
        # Make the invited member an admin first (a person can't change their own role).
        async with Session() as s:
            u = await s.scalar(select(User).where(User.email == PRO_EMAIL))
            assert u is not None
            u.role = Role.admin
            await s.commit()
        body = {
            "name": "Added",
            "email": "added@zz-clerk.example",
            "role": "member",
            "departments": ["HR"],
        }
        r = await c.post("/team", headers=bearer("user_inv"), json=body)
        assert r.status_code == 201, r.text
        assert r.json()["invite"] == "sent"
    assert sent == ["added@zz-clerk.example"]
    assert await team_routes.send_invite(Organization(plan="demo"), "x@y.io") is None


async def test_super_admin_can_invite_a_waitlist_entry(monkeypatch: pytest.MonkeyPatch) -> None:
    from atlas_api import super_routes

    invited: list[str] = []

    async def fake(entry_id: str) -> None:
        invited.append(entry_id)

    monkeypatch.setattr(settings, "session_secret", "s" * 32)
    monkeypatch.setattr(settings, "clerk_secret_key", "sk_test_x")
    monkeypatch.setattr(clerk, "invite_waitlist_entry", fake)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        assert (await c.post("/super/waitlist/wle_1/invite")).status_code == 401
        c.cookies.set(super_routes.COOKIE, super_routes.make_token())
        assert (await c.post("/super/waitlist/wle_1/invite")).status_code == 204
        assert (await c.post("/super/waitlist/bad%20id/invite")).status_code == 404
    assert invited == ["wle_1"]


async def test_invite_existing_clerk_user_is_not_an_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(req: httpx.Request) -> httpx.Response:
        assert req.url.path == "/v1/invitations"
        assert json.loads(req.content)["redirect_url"] == f"{P10}/sign-up"
        return httpx.Response(400, json={"errors": [{"code": "form_identifier_exists"}]})

    real = httpx.AsyncClient
    monkeypatch.setattr(
        "atlas_api.clerk.httpx.AsyncClient",
        lambda **kw: real(transport=httpx.MockTransport(handler), **kw),
    )
    assert await clerk.invite("a@b.io") == "exists"
