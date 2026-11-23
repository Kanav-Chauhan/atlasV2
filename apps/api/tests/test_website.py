"""Phase 8: website visitor principal and filter, public routes (key, origin, honeypot, length,
rate limit), admin-only settings, key rotation, PATCH is_public. No database, no Redis."""

from collections.abc import AsyncIterator, Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from langgraph.checkpoint.memory import InMemorySaver
from llama_index.core.vector_stores import MetadataFilters
from sqlalchemy.dialects import postgresql

from atlas_api import access, chat_routes, graph, website, website_routes
from atlas_api.cache import scope, visitor_scope
from atlas_api.main import app
from atlas_api.models import Chat, Department, Document, Organization, Role, User
from atlas_api.routes import current_user, db

NOW = datetime(2026, 11, 22, tzinfo=UTC)
P10 = "https://p1.kanav.space"
SHOP = "https://shop.example.com"
KEY = "k" * 22


def org(**cfg: Any) -> Organization:
    base = {"enabled": True, "site_key": KEY, "allowed_origins": [SHOP]}
    return Organization(
        id=1, slug="x", name="Nimbus", industry="", description="", website_chat=base | cfg
    )


def user(role: Role, o: Organization | None = None) -> User:
    return User(
        id=1,
        org_id=1,
        email=f"{role}@x.example",
        name=str(role),
        title="",
        role=role,
        org=o or org(),
        departments=[Department(name="HR")],
    )


# ------------------------------------------------------------------ principal + filter


def _sql(filters: MetadataFilters) -> str:
    from atlas_api.ingest import store

    clause = store()._recursively_apply_filters(filters)  # type: ignore[arg-type]
    return str(clause.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))  # type: ignore[no-untyped-call]


def test_visitor_filter_is_org_and_public_only() -> None:
    f = access.chunk_filters(access.Visitor(org_id=5))
    assert f == access.public_filters(5)
    sql = _sql(f)
    assert sql == "(metadata_->>'org_id')::float = 5.0 AND metadata_->>'is_public' = 'true'"
    # No OR anywhere: no access/department branch can widen it.
    assert " OR " not in sql.upper()


def _matches(meta: dict[str, Any], f: MetadataFilters) -> bool:
    """Evaluate the filter the way the SQL above does (metadata_->>key compared as text)."""
    out = []
    for x in f.filters:
        assert not isinstance(x, MetadataFilters)
        v = meta.get(x.key)
        if isinstance(x.value, int):
            out.append(v is not None and float(v) == float(x.value))
        else:
            out.append((str(v).lower() if isinstance(v, bool) else v) == x.value)
    return all(out)


def test_visitor_never_matches_a_non_public_chunk() -> None:
    f = access.public_filters(5)
    chunks = [
        {"org_id": 5, "access": "Everyone", "is_public": True},
        {"org_id": 5, "access": "Everyone", "is_public": False},
        {"org_id": 5, "access": "HR", "is_public": False},
        {"org_id": 6, "access": "Everyone", "is_public": True},
        {"org_id": 5, "access": "Everyone"},
    ]
    assert [_matches(c, f) for c in chunks] == [True, False, False, False, False]


def test_visitor_cache_scope_is_separate() -> None:
    v = visitor_scope(1, "en")
    assert v != visitor_scope(2, "en") and v != visitor_scope(1, "hi")
    assert all(v != scope(1, r, set(), "en") for r in Role)


async def test_visitor_graph_wording_no_suggestions() -> None:
    from test_chat import FakeModels, make_ctx, run, text

    ctx = make_ctx(FakeModels())
    ctx.visitor, ctx.suggested, ctx.greeting = True, [], "Hello from Nimbus!"
    events, _ = await run(graph.build(InMemorySaver()), "Hi", ctx)
    assert text(events) == "Hello from Nimbus!"
    weak = make_ctx(FakeModels(), score=0.5)
    weak.visitor = True
    events, final = await run(graph.build(InMemorySaver()), "Salary band for L4?", weak)
    assert final["abstained"] and "contact Nimbus" in text(events)
    assert graph.NOT_FOUND not in text(events)


# ------------------------------------------------------------------ fakes


class Result:
    def __init__(self, rows: list[Any] | None = None) -> None:
        self.rows = rows or []

    def __iter__(self) -> Iterator[Any]:
        return iter(self.rows)


class FakeSession:
    def __init__(self, o: Organization | None = None, doc: Document | None = None) -> None:
        self.org = o
        self.doc = doc
        self.added: list[Any] = []
        self.executed: list[str] = []
        self.commits = 0

    async def scalar(self, q: Any) -> Any:
        s = str(q)
        if "FROM organizations" in s and "website_chat" in s:
            params = q.compile().params.values()
            if self.org and self.org.website_chat.get("site_key") in params:
                return self.org
            return None
        if "to_regclass" in s:
            return "data_chunks"
        return 0

    async def scalars(self, q: Any) -> Result:
        return Result()

    async def execute(self, q: Any, *a: Any) -> Result:
        self.executed.append(str(q))
        return Result()

    async def get(self, model: Any, id: Any) -> Any:
        return self.doc if model is Document else None

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.commits += 1


class FakeRedis:
    def __init__(self) -> None:
        self.n: dict[str, int] = {}

    async def incr(self, key: str) -> int:
        self.n[key] = self.n.get(key, 0) + 1
        return self.n[key]

    async def expire(self, key: str, s: int) -> None:
        pass


@pytest.fixture(autouse=True)
def _env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(website_routes, "redis", FakeRedis())

    async def no_prune() -> None:
        return None

    async def fake_turn(
        question: str, ctx: graph.Ctx, tid: str, chat_id: str
    ) -> AsyncIterator[str]:
        fake_turn.calls.append((question, ctx, tid, chat_id))  # type: ignore[attr-defined]
        yield 'data: {"type": "start"}\n\n'

    fake_turn.calls = []  # type: ignore[attr-defined]
    monkeypatch.setattr(website_routes, "prune_visitor_threads", no_prune)
    monkeypatch.setattr(chat_routes, "turn_stream", fake_turn)
    yield
    app.dependency_overrides.clear()


def client(session: FakeSession, actor: User | None = None) -> AsyncClient:
    app.dependency_overrides[db] = lambda: session
    if actor is not None:
        app.dependency_overrides[current_user] = lambda: actor
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def chat_body(q: str = "What is NimbusOps?", **extra: Any) -> dict[str, Any]:
    msg = {"id": "m1", "role": "user", "parts": [{"type": "text", "text": q}]}
    return {"id": "thread-abc123", "messages": [msg]} | extra


# ------------------------------------------------------------------ public routes


async def test_config_ok_with_cors() -> None:
    async with client(FakeSession(org())) as c:
        r = await c.get(f"/public/{KEY}/config", headers={"origin": SHOP})
    assert r.status_code == 200
    assert r.json() == {
        "company": "Nimbus",
        "greeting": "Hi! Ask me anything about Nimbus.",
        "accent": "#2563eb",
        "position": "right",
        "show_badge": True,
        "allowed_origins": sorted([P10, SHOP]),
    }
    assert r.headers["access-control-allow-origin"] == SHOP


@pytest.mark.parametrize("o", [None, org(enabled=False)], ids=["unknown key", "disabled"])
async def test_unknown_or_disabled_key_404(o: Organization | None) -> None:
    async with client(FakeSession(o)) as c:
        assert (await c.get(f"/public/{KEY}/config", headers={"origin": P10})).status_code == 404
        r = await c.post(f"/public/{KEY}/chat", json=chat_body(), headers={"origin": P10})
        assert r.status_code == 404
        assert (await c.get("/public/bad key!/config")).status_code == 404


async def test_origin_check() -> None:
    async with client(FakeSession(org())) as c:
        url = f"/public/{KEY}/config"
        assert (await c.get(url, headers={"origin": "https://evil.example"})).status_code == 403
        assert (await c.get(url)).status_code == 403  # no Origin, no Referer
        assert (await c.get(url, headers={"origin": P10})).status_code == 200  # /embed on p10
        ok = await c.get(url, headers={"referer": f"{SHOP}/pricing?x=1"})
        assert ok.status_code == 200
        bad = await c.get(url, headers={"referer": "https://shop.example.com.evil.io/"})
        assert bad.status_code == 403
        pre = await c.options(f"/public/{KEY}/chat", headers={"origin": SHOP})
        assert pre.status_code == 204 and pre.headers["access-control-allow-origin"] == SHOP
        r = await c.options(f"/public/{KEY}/chat", headers={"origin": "https://evil.example"})
        assert r.status_code == 403


async def test_public_chat_runs_as_visitor() -> None:
    session = FakeSession(org())
    async with client(session) as c:
        r = await c.post(f"/public/{KEY}/chat", json=chat_body(), headers={"origin": SHOP})
    assert r.status_code == 200, r.text
    question, ctx, tid, chat_id = chat_routes.turn_stream.calls[-1]  # type: ignore[attr-defined]
    assert question == "What is NimbusOps?"
    assert ctx.visitor and ctx.suggested == []
    assert ctx.filters == access.public_filters(1)
    assert tid == f"visitor:{KEY}:thread-abc123"
    assert chat_id.startswith("v-")
    chat = next(x for x in session.added if isinstance(x, Chat))
    assert chat.user_id is None and chat.origin == SHOP


async def test_honeypot_and_length() -> None:
    async with client(FakeSession(org())) as c:
        url, h = f"/public/{KEY}/chat", {"origin": SHOP}
        assert (await c.post(url, json=chat_body(website="spam.io"), headers=h)).status_code == 400
        assert (await c.post(url, json=chat_body("x" * 501), headers=h)).status_code == 400
        assert (await c.post(url, json=chat_body("x" * 500), headers=h)).status_code == 200


async def test_rate_limit_per_ip() -> None:
    async with client(FakeSession(org())) as c:
        url = f"/public/{KEY}/chat"
        h = {"origin": SHOP, "x-forwarded-for": "203.0.113.9"}
        codes = [(await c.post(url, json=chat_body(), headers=h)).status_code for _ in range(11)]
        assert codes == [200] * 10 + [429]
        other = {"origin": SHOP, "x-forwarded-for": "203.0.113.10"}
        assert (await c.post(url, json=chat_body(), headers=other)).status_code == 200


@pytest.mark.parametrize(
    ("headers", "peer", "ip"),
    [
        ({"x-forwarded-for": "6.6.6.6, 203.0.113.9"}, "10.0.0.2", "203.0.113.9"),  # spoofed first
        ({"x-forwarded-for": "203.0.113.9"}, "10.0.0.2", "203.0.113.9"),
        ({"x-real-ip": "6.6.6.6", "x-forwarded-for": "198.51.100.7"}, None, "198.51.100.7"),
        ({}, "10.0.0.2", "10.0.0.2"),
        ({}, None, "?"),
    ],
)
def test_client_ip_uses_last_proxy_hop(headers: dict[str, str], peer: str | None, ip: str) -> None:
    assert website.client_ip(headers, peer) == ip


async def test_rate_limit_ignores_spoofed_first_hop() -> None:
    async with client(FakeSession(org())) as c:
        url = f"/public/{KEY}/chat"
        codes = [
            (
                await c.post(
                    url,
                    json=chat_body(),
                    headers={"origin": SHOP, "x-forwarded-for": f"6.6.6.{i}, 203.0.113.50"},
                )
            ).status_code
            for i in range(11)
        ]
    assert codes == [200] * 10 + [429]


async def test_rate_limit_per_site_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(website_routes.LIMITS, "key_day", 3)
    async with client(FakeSession(org())) as c:
        url = f"/public/{KEY}/chat"
        codes = [
            (
                await c.post(
                    url,
                    json=chat_body(),
                    headers={"origin": SHOP, "x-forwarded-for": f"198.51.100.{i}"},
                )
            ).status_code
            for i in range(4)
        ]
    assert codes == [200, 200, 200, 429]


# ------------------------------------------------------------------ admin routes

ADMIN_ENDPOINTS = [
    ("GET", "/website-chat", None),
    ("PATCH", "/website-chat", {"greeting": "Hello"}),
    ("POST", "/website-chat/rotate-key", None),
    ("PATCH", "/documents/3", {"is_public": True}),
    ("GET", "/website-chat/conversations?days=7", None),
    ("GET", "/website-chat/conversations/v-x", None),
]


@pytest.mark.parametrize("role", list(Role))
@pytest.mark.parametrize(("method", "path", "body"), ADMIN_ENDPOINTS)
async def test_admin_only(role: Role, method: str, path: str, body: dict[str, Any] | None) -> None:
    doc = Document(
        id=3,
        org_id=1,
        title="T",
        access="Everyone",
        is_public=False,
        format="md",
        status="ready",
        file_path="/x",
        sha256="0",
        updated_at=NOW,
    )
    async with client(FakeSession(org(), doc), user(role)) as c:
        r = await c.request(method, path, json=body)
    if role == Role.admin:
        assert r.status_code not in (401, 403, 500), (r.status_code, r.text)
    else:
        assert r.status_code == 403, (r.status_code, r.text)


async def test_settings_patch_validates_and_normalizes() -> None:
    o = org()
    async with client(FakeSession(o), user(Role.admin, o)) as c:
        r = await c.patch(
            "/website-chat",
            json={"allowed_origins": ["https://Shop.Example.com/", SHOP], "position": "left"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["allowed_origins"] == [SHOP] and r.json()["position"] == "left"
        assert (
            await c.patch("/website-chat", json={"allowed_origins": ["shop"]})
        ).status_code == 422
        assert (await c.patch("/website-chat", json={"accent": "red"})).status_code == 422
        assert (await c.patch("/website-chat", json={"show_badge": False})).status_code == 422


async def test_rotate_key_invalidates_old_key() -> None:
    o = org()
    session = FakeSession(o)
    async with client(session, user(Role.admin, o)) as c:
        r = await c.post("/website-chat/rotate-key")
        new = r.json()["site_key"]
        assert new != KEY and website.config(o)["site_key"] == new
        old = await c.get(f"/public/{KEY}/config", headers={"origin": SHOP})
        assert old.status_code == 404
        assert (await c.get(f"/public/{new}/config", headers={"origin": SHOP})).status_code == 200


async def test_patch_is_public_updates_chunks_and_needs_everyone() -> None:
    doc = Document(
        id=3,
        org_id=1,
        title="T",
        access="Everyone",
        is_public=False,
        format="md",
        status="ready",
        file_path="/x",
        sha256="0",
        updated_at=NOW,
    )
    session = FakeSession(org(), doc)
    async with client(session, user(Role.admin)) as c:
        r = await c.patch("/documents/3", json={"is_public": True})
        assert r.status_code == 200 and r.json()["is_public"] is True
        assert any("jsonb_set" in q for q in session.executed)
        doc.access, doc.is_public = "HR", False
        assert (await c.patch("/documents/3", json={"is_public": True})).status_code == 400
        doc.org_id = 2
        assert (await c.patch("/documents/3", json={"is_public": False})).status_code == 404


@pytest.mark.integration
def test_visitor_filter_on_real_chunks() -> None:
    """Every chunk the visitor filter selects is public and in that org; it selects some."""
    from sqlalchemy import text as sql

    from atlas_api.db import sync_engine

    with sync_engine.connect() as conn:
        orgs = [r[0] for r in conn.execute(sql("SELECT id FROM organizations"))]
        for org_id in orgs:
            where = _sql(access.public_filters(org_id))
            rows = conn.execute(
                sql(
                    f"SELECT metadata_->>'is_public', metadata_->>'org_id' FROM data_chunks "
                    f"WHERE {where}"
                )
            ).all()
            assert rows, org_id
            assert {r[0] for r in rows} == {"true"}
            assert {r[1] for r in rows} == {str(org_id)}
