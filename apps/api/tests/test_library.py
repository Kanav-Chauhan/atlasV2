"""GET /documents/library (UI Phase 4): pagination, search, filters, sort, counts, and the access
rule under every filter combination. Runs the real endpoint and SQL on an in-memory SQLite copy
of the documents table (no Postgres needed)."""

import itertools
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from atlas_api.main import app
from atlas_api.models import Department, Document, Organization, Role, Status, User
from atlas_api.routes import current_user, db

pytest.importorskip("aiosqlite")


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(*_: Any, **__: Any) -> str:
    return "JSON"


T0 = datetime(2026, 1, 1, tzinfo=UTC)
DEPTS = ["Everyone", "HR", "Finance", "Engineering", "Managers"]
FORMATS = ["pdf", "docx", "md", "txt"]
STATUSES = [Status.ready, Status.processing, Status.queued, Status.failed]


def docs() -> list[Document]:
    """60 documents in org 1 spread over departments, formats, statuses, public flags and review
    dates, plus 5 in another company that nobody here may ever see."""
    out = []
    for i in range(60):
        dept = DEPTS[i % len(DEPTS)]
        out.append(
            Document(
                id=i + 1,
                org_id=1,
                title=f"{'Leave policy' if i % 7 == 0 else 'Handbook'} {i:02d}",
                doc_no=f"NIM-{i:03d}",
                access=dept,
                is_public=dept == "Everyone" and i % 2 == 0,
                format=FORMATS[i % 4],
                status=STATUSES[i % 4],
                file_path=f"/x/{i}",
                sha256=f"{i:064d}",
                pages=3 if i % 4 == 0 else None,
                meta={"review": "1 January 2020"} if i % 6 == 0 else {},
                updated_at=T0 + timedelta(days=i),
            )
        )
    for i in range(5):
        out.append(
            Document(
                id=100 + i,
                org_id=2,
                title=f"Other company handbook {i}",
                access="Everyone",
                is_public=True,
                format="pdf",
                status=Status.ready,
                file_path=f"/y/{i}",
                sha256=f"{100 + i:064d}",
                updated_at=T0,
            )
        )
    return out


def person(role: Role, *depts: str) -> User:
    return User(
        id=1,
        org_id=1,
        email=f"{role}@x.example",
        name=str(role),
        title="",
        role=role,
        org=Organization(id=1, slug="x", name="X", industry="", description=""),
        departments=[Department(name=d) for d in depts],
    )


@pytest.fixture(scope="module")
async def sessions() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda c: Document.metadata.create_all(
                c, tables=[Document.metadata.tables[t] for t in ("departments", "documents")]
            )
        )
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as s:
        s.add_all(docs())
        org_depts = [Department(id=n, org_id=1, name=d) for n, d in enumerate(DEPTS[1:], 1)]
        s.add_all([*org_depts, Department(id=99, org_id=2, name="Secret")])
        await s.commit()
    yield maker
    await engine.dispose()


@asynccontextmanager
async def client(
    maker: async_sessionmaker[AsyncSession], actor: User
) -> AsyncIterator[AsyncClient]:
    async def session() -> AsyncIterator[AsyncSession]:
        async with maker() as s:
            yield s

    app.dependency_overrides[db] = session
    app.dependency_overrides[current_user] = lambda: actor
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
            yield c
    finally:
        app.dependency_overrides.clear()


async def fetch(c: AsyncClient, **params: Any) -> dict[str, Any]:
    r = await c.get("/documents/library", params=params)
    assert r.status_code == 200, r.text
    body: dict[str, Any] = r.json()
    return body


async def get(
    maker: async_sessionmaker[AsyncSession], actor: User, **params: Any
) -> dict[str, Any]:
    async with client(maker, actor) as c:
        return await fetch(c, **params)


def readable(actor: User) -> list[Document]:
    return [
        d
        for d in docs()
        if d.org_id == 1
        and (actor.role == Role.admin or d.access in {"Everyone", *actor.department_names})
    ]


async def test_pages_of_20_with_total(sessions: async_sessionmaker[AsyncSession]) -> None:
    admin = person(Role.admin)
    first = await get(sessions, admin)
    assert (first["total"], first["all"], first["page"], first["per_page"]) == (60, 60, 1, 20)
    assert len(first["items"]) == 20
    # Newest first by default.
    assert first["items"][0]["id"] == 60 and first["items"][1]["id"] == 59
    last = await get(sessions, admin, page=3)
    assert len(last["items"]) == 20 and last["items"][-1]["id"] == 1
    assert (await get(sessions, admin, page=4))["items"] == []
    seen = {d["id"] for p in (1, 2, 3) for d in (await get(sessions, admin, page=p))["items"]}
    assert seen == set(range(1, 61))


async def test_search_filters_and_sort(sessions: async_sessionmaker[AsyncSession]) -> None:
    admin = person(Role.admin)
    leave = await get(sessions, admin, q="leave")
    assert leave["total"] == 9 and all("Leave" in d["title"] for d in leave["items"])
    assert [d["id"] for d in (await get(sessions, admin, q="NIM-042"))["items"]] == [43]
    # % and _ are literal, not wildcards.
    assert (await get(sessions, admin, q="%"))["total"] == 0

    hr = await get(sessions, admin, dept="HR", per_page=100)
    assert hr["total"] == 12 and {d["access"] for d in hr["items"]} == {"HR"}
    pdf = await get(sessions, admin, format="pdf", per_page=100)
    assert pdf["total"] == 15 and {d["format"] for d in pdf["items"]} == {"pdf"}
    busy = await get(sessions, admin, status="processing", per_page=100)
    assert busy["total"] == 30 and {d["status"] for d in busy["items"]} == {"queued", "processing"}
    pub = await get(sessions, admin, public="true", per_page=100)
    assert pub["total"] == 6 and all(d["is_public"] for d in pub["items"])

    by_title = await get(sessions, admin, sort="title", per_page=100)
    titles = [d["title"].lower() for d in by_title["items"]]
    assert titles == sorted(titles)

    assert admin_counts(await get(sessions, admin, q="nothing matches")) == (15, 30, 15)


def admin_counts(body: dict[str, Any]) -> tuple[int, int, int]:
    c = body["counts"]
    return c["ready"], c["processing"], c["failed"]


async def test_needs_review_only_for_what_you_manage(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    admin = await get(sessions, person(Role.admin), status="review", per_page=100)
    assert {d["id"] for d in admin["items"]} == {i + 1 for i in range(0, 60, 6)}
    assert all(d["review"] for d in admin["items"])

    # A manager sees review reasons for their own department only (not Everyone).
    hr = person(Role.manager, "HR")
    mine = await get(sessions, hr, status="review", per_page=100)
    assert mine["items"] and {d["access"] for d in mine["items"]} == {"HR"}
    listed = await get(sessions, hr, per_page=100)
    assert all(d["review"] is None for d in listed["items"] if d["access"] != "HR")

    # Members manage nothing: no review badges, the filter finds nothing.
    member = person(Role.member, "HR")
    assert (await get(sessions, member, status="review"))["total"] == 0
    assert all(d["review"] is None for d in (await get(sessions, member))["items"])


async def test_departments_offered(sessions: async_sessionmaker[AsyncSession]) -> None:
    assert (await get(sessions, person(Role.admin)))["departments"] == [
        "Everyone",
        "Engineering",
        "Finance",
        "HR",
        "Managers",
    ]
    assert (await get(sessions, person(Role.member, "HR")))["departments"] == ["Everyone", "HR"]


QUERIES: list[dict[str, Any]] = [
    {"q": q, "dept": dept, "format": fmt, "status": st, "public": pub}
    for q, dept, fmt, st, pub in itertools.product(
        ["", "handbook"],
        ["", "Everyone", "HR", "Finance"],
        ["", "pdf"],
        ["", "ready", "processing", "failed", "review"],
        ["", "true"],
    )
]


@pytest.mark.parametrize(
    "actor",
    [
        person(Role.member, "HR"),
        person(Role.guest),
        person(Role.manager, "HR", "Managers"),
    ],
    ids=["member-HR", "guest", "manager-HR"],
)
async def test_never_other_departments_in_any_filter_combo(
    sessions: async_sessionmaker[AsyncSession], actor: User
) -> None:
    allowed = {d.id for d in readable(actor)}
    assert allowed and len(allowed) < 60
    async with client(sessions, actor) as c:
        for params in QUERIES:
            clean = {k: v for k, v in params.items() if v}
            body = await fetch(c, per_page=100, **clean)
            ids = {d["id"] for d in body["items"]}
            assert ids <= allowed, (clean, ids - allowed)
            assert body["total"] <= len(allowed), clean
            assert body["all"] == len(allowed)
        # Asking for another department by name returns nothing, not its documents.
        assert (await fetch(c, dept="Finance"))["total"] == 0


async def test_other_company_never_listed(sessions: async_sessionmaker[AsyncSession]) -> None:
    body = await get(sessions, person(Role.admin), q="Other company", per_page=100)
    assert body["total"] == 0 and body["all"] == 60
    assert "Secret" not in (await get(sessions, person(Role.admin)))["departments"]
