"""Phase 8 endpoints: website chat settings (admin) and the public visitor API
(docs/API.md "Endpoints (Phase 8: website chat)").

Public routes never take a cookie and only ever see the company's public documents
(access.Visitor → access.public_filters). Checks on every public request: the site key exists
and is enabled (else 404), the calling page's Origin/Referer is allowed (else 403).
"""

import asyncio
import hashlib
import logging
import re
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator
from sqlalchemy import func, select, text

from atlas_api import access, cache, chat_routes, graph, plans, website
from atlas_api.cache import visitor_scope
from atlas_api.db import CHUNKS_TABLE, Session, redis
from atlas_api.llm import VisitorModels
from atlas_api.models import EVERYONE, Chat, Document, Message, Organization, Role, User
from atlas_api.routes import DB, CurrentUser, DocumentOut
from atlas_api.settings import settings
from atlas_api.stream import HEADERS

log = logging.getLogger(__name__)
router = APIRouter()

MAX_QUESTION = 500
LIMITS = {"ip_min": 10, "ip_day": 100, "key_day": 1000}


def admin_only(user: User) -> None:
    if user.role != Role.admin:
        raise HTTPException(403, "Only an admin can manage website chat.")


# ------------------------------------------------------------------ admin: settings


class WebsiteChatOut(BaseModel):
    enabled: bool
    site_key: str
    allowed_origins: list[str]
    greeting: str
    accent: str
    position: Literal["right", "left"]
    show_badge: bool
    public_documents: int


async def settings_out(s: Any, org: Organization) -> WebsiteChatOut:
    cfg = website.config(org)
    public = await s.scalar(
        select(func.count(Document.id)).where(Document.org_id == org.id, Document.is_public)
    )
    return WebsiteChatOut(
        **{k: cfg[k] for k in website.DEFAULTS if k != "greeting"},
        greeting=website.greeting(org),
        public_documents=public or 0,
    )


@router.get("/website-chat")
async def get_website_chat(user: CurrentUser, s: DB) -> WebsiteChatOut:
    admin_only(user)
    return await settings_out(s, user.org)


class WebsiteChatPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool | None = None
    allowed_origins: list[str] | None = None
    greeting: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None
    accent: Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")] | None = None
    position: Literal["right", "left"] | None = None

    @field_validator("allowed_origins")
    @classmethod
    def _origins(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        if len(v) > 20:
            raise ValueError("At most 20 website addresses.")
        out = []
        for raw in v:
            o = website.normalize_origin(raw)
            if o is None:
                raise ValueError(f"{raw!r} is not a website address like https://example.com")
            if o not in out:
                out.append(o)
        return out


async def save(s: Any, org: Organization, changes: dict[str, Any]) -> None:
    org.website_chat = website.config(org) | changes  # a new dict: SQLAlchemy sees the change
    await s.commit()


DEMO_LOCKED = ("enabled", "allowed_origins", "site_key")


@router.patch("/website-chat")
async def patch_website_chat(body: WebsiteChatPatch, user: CurrentUser, s: DB) -> WebsiteChatOut:
    admin_only(user)
    changes = body.model_dump(exclude_none=True)
    if user.org.plan == "demo":
        # Demo websites embed a fixed key and anyone can be a demo Admin: keep these locked (D-066).
        for k in DEMO_LOCKED:
            changes.pop(k, None)
    if changes.get("enabled") and not website.config(user.org)["site_key"]:
        changes["site_key"] = website.new_key()
    await save(s, user.org, changes)
    return await settings_out(s, user.org)


@router.post("/website-chat/rotate-key")
async def rotate_key(user: CurrentUser, s: DB) -> dict[str, str]:
    admin_only(user)
    if user.org.plan == "demo":
        raise HTTPException(
            403, "The demo company's key is fixed so its demo website keeps working."
        )
    key = website.new_key()
    await save(s, user.org, {"site_key": key})
    return {"site_key": key}


class PublicPatch(BaseModel):
    is_public: bool


@router.patch("/documents/{doc_id}")
async def set_public(doc_id: int, body: PublicPatch, user: CurrentUser, s: DB) -> DocumentOut:
    if user.role != Role.admin:
        raise HTTPException(403, "Only an admin can make a document public.")
    doc = await s.get(Document, doc_id)
    if doc is None or doc.org_id != user.org_id:
        raise HTTPException(404, "Document not found.")
    if body.is_public and doc.access != EVERYONE:
        raise HTTPException(400, "Only documents visible to Everyone can be public.")
    doc.is_public = body.is_public
    # The chunks carry is_public too (the visitor's retrieval filter reads it there).
    if await s.scalar(text(f"SELECT to_regclass('{CHUNKS_TABLE}')")):
        await s.execute(
            text(
                f"UPDATE {CHUNKS_TABLE} SET metadata_ = jsonb_set(metadata_, '{{is_public}}', "
                "to_jsonb(CAST(:v AS boolean))) WHERE metadata_->>'document_id' = :id"
            ),
            {"v": body.is_public, "id": str(doc.id)},
        )
    await s.commit()
    await s.refresh(doc)  # commit expired it; reading it lazily in async would fail
    await cache.invalidate(user.org_id)  # visitors' cached answers may cite it
    return DocumentOut.model_validate(doc)


# ------------------------------------------------------------------ admin: visitor chats


def like(q: str) -> str:
    """A user's search text as an ILIKE pattern: % and _ match themselves (escape char \\)."""
    return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


PerPage = Annotated[int, Query(ge=1, le=100)]
PageNo = Annotated[int, Query(ge=1, le=10_000)]
SearchText = Annotated[str, Query(max_length=200)]


class WebsiteDocsOut(BaseModel):
    items: list[DocumentOut]
    total: int  # matching this query
    public_total: int  # all public documents of the company (what the website bot reads)
    page: int
    per_page: int


@router.get("/website-chat/documents")
async def website_documents(
    user: CurrentUser,
    s: DB,
    public: bool = True,
    q: SearchText = "",
    page: PageNo = 1,
    per_page: PerPage = 20,
) -> WebsiteDocsOut:
    """public=true: what the website bot answers from. public=false: the rest of the library
    (the "Pick from Library" list), Everyone documents first; department documents are listed
    with their department so the admin sees why they can't be made public."""
    admin_only(user)
    where = [Document.org_id == user.org_id, Document.is_public.is_(public)]
    if q.strip():
        where.append(Document.title.ilike(like(q.strip()), escape="\\"))
    order: list[Any] = [Document.title, Document.id]
    if not public:
        order.insert(0, Document.access != EVERYONE)
    total = await s.scalar(select(func.count(Document.id)).where(*where)) or 0
    public_total = await s.scalar(
        select(func.count(Document.id)).where(Document.org_id == user.org_id, Document.is_public)
    )
    docs = await s.scalars(
        select(Document)
        .where(*where)
        .order_by(*order)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    return WebsiteDocsOut(
        items=[DocumentOut.model_validate(d) for d in docs],
        total=total,
        public_total=public_total or 0,
        page=page,
        per_page=per_page,
    )


class ConversationOut(BaseModel):
    id: str
    started_at: datetime
    updated_at: datetime
    origin: str | None
    messages: int
    first_question: str
    last_question: str
    not_found: bool


class ConversationsOut(BaseModel):
    items: list[ConversationOut]
    total: int
    page: int
    per_page: int


@router.get("/website-chat/conversations")
async def conversations(
    user: CurrentUser,
    s: DB,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
    q: SearchText = "",
    not_found: bool = False,
    page: PageNo = 1,
    per_page: PerPage = 20,
) -> ConversationsOut:
    """Visitor chats, newest activity first, one page at a time. q matches any message text
    (question or answer) or the website address; not_found=true keeps chats with a
    "not found" answer."""
    admin_only(user)
    since = datetime.now(UTC) - timedelta(days=days)
    where = [Chat.org_id == user.org_id, Chat.user_id.is_(None), Chat.updated_at >= since]
    if q.strip():
        pattern = like(q.strip())
        where.append(
            Chat.id.in_(select(Message.chat_id).where(Message.text.ilike(pattern, escape="\\")))
            | Chat.origin.ilike(pattern, escape="\\")
        )
    if not_found:
        where.append(Chat.id.in_(select(Message.chat_id).where(Message.abstained.is_(True))))
    total = await s.scalar(select(func.count(Chat.id)).where(*where)) or 0
    chats = list(
        await s.scalars(
            select(Chat)
            .where(*where)
            .order_by(Chat.updated_at.desc(), Chat.id)
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    )
    rows = await s.execute(
        select(Message.chat_id, Message.role, Message.text, Message.abstained)
        .where(Message.chat_id.in_([c.id for c in chats]))
        .order_by(Message.created_at, Message.id)
    )
    stats: dict[str, dict[str, Any]] = {}
    for chat_id, role, body, abstained in rows:
        st = stats.setdefault(chat_id, {"n": 0, "first": "", "last": "", "nf": False})
        st["n"] += 1
        if role == "user":
            st["first"] = st["first"] or body
            st["last"] = body
        st["nf"] = st["nf"] or bool(abstained)
    empty = {"n": 0, "first": "", "last": "", "nf": False}
    return ConversationsOut(
        items=[
            ConversationOut(
                id=c.id,
                started_at=c.created_at,
                updated_at=c.updated_at,
                origin=c.origin,
                messages=stats.get(c.id, empty)["n"],
                first_question=stats.get(c.id, empty)["first"] or c.title,
                last_question=stats.get(c.id, empty)["last"],
                not_found=stats.get(c.id, empty)["nf"],
            )
            for c in chats
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/website-chat/conversations/{chat_id}")
async def conversation(chat_id: str, user: CurrentUser, s: DB) -> dict[str, Any]:
    admin_only(user)
    c = await s.get(Chat, chat_id)
    if c is None or c.org_id != user.org_id or c.user_id is not None:
        raise HTTPException(404, "Conversation not found.")
    rows = await s.scalars(
        select(Message).where(Message.chat_id == c.id).order_by(Message.created_at, Message.id)
    )
    return {
        "id": c.id,
        "started_at": c.created_at,
        "origin": c.origin,
        "messages": [chat_routes.ui_message(m) for m in rows],
    }


# ------------------------------------------------------------------ public


SITE_KEY = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


async def site(s: Any, site_key: str) -> Organization:
    org: Organization | None = None
    if SITE_KEY.match(site_key):
        org = await s.scalar(
            select(Organization).where(Organization.website_chat["site_key"].astext == site_key)
        )
    if org is None or not website.config(org)["enabled"]:
        raise HTTPException(404, "This chat is not available.")
    return org


def caller_origin(request: Request) -> str | None:
    return website.request_origin(request.headers.get("origin"), request.headers.get("referer"))


def check_origin(org: Organization, request: Request) -> str:
    origin = caller_origin(request)
    if not website.allowed(org, origin):
        raise HTTPException(403, "This website is not allowed to use this chat.")
    assert origin is not None
    return origin


def cors(response: Response, request: Request, org: Organization) -> None:
    origin = request.headers.get("origin")
    if origin and website.allowed(org, website.normalize_origin(origin)):
        response.headers["access-control-allow-origin"] = origin
        response.headers["vary"] = "Origin"


@router.options("/public/{site_key}/{rest:path}")
async def preflight(site_key: str, rest: str, request: Request, s: DB) -> Response:
    org = await site(s, site_key)
    check_origin(org, request)
    r = Response(status_code=204)
    cors(r, request, org)
    r.headers["access-control-allow-methods"] = "GET, POST, OPTIONS"
    r.headers["access-control-allow-headers"] = "content-type"
    r.headers["access-control-max-age"] = "600"
    return r


class PublicConfig(BaseModel):
    company: str
    greeting: str
    accent: str
    position: str
    show_badge: bool
    allowed_origins: list[str]  # public anyway; the web app sets frame-ancestors from it


@router.get("/public/{site_key}/config")
async def public_config(site_key: str, request: Request, response: Response, s: DB) -> PublicConfig:
    org = await site(s, site_key)
    check_origin(org, request)
    cors(response, request, org)
    cfg = website.config(org)
    return PublicConfig(
        company=org.name,
        greeting=website.greeting(org),
        accent=cfg["accent"],
        position=cfg["position"],
        show_badge=cfg["show_badge"],
        allowed_origins=sorted({settings.app_origin, *cfg["allowed_origins"]}),
    )


async def under_limit(key: str, limit: int, ttl: int) -> bool:
    n = int(await redis.incr(key))
    if n == 1:
        await redis.expire(key, ttl)
    return n <= limit


async def rate_limit(ip: str, org_id: int) -> None:
    now = datetime.now(UTC)
    minute, day = now.strftime("%Y%m%d%H%M"), now.strftime("%Y%m%d")
    checks = [
        (f"atlas:pub:ip:{ip}:m:{minute}", LIMITS["ip_min"], 60, "a minute"),
        (f"atlas:pub:ip:{ip}:d:{day}", LIMITS["ip_day"], 86400, "today"),
        (f"atlas:pub:org:{org_id}:d:{day}", LIMITS["key_day"], 86400, "today"),
    ]
    for key, limit, ttl, when in checks:
        if not await under_limit(key, limit, ttl):
            raise HTTPException(429, f"Too many questions {when}. Please try again later.")


class PublicChatIn(chat_routes.ChatIn):
    website: str = ""  # honeypot: hidden field, people leave it empty, bots fill it


def visitor_chat_id(org_id: int, thread: str) -> str:
    return "v-" + hashlib.sha256(f"{org_id}:{thread}".encode()).hexdigest()[:32]


def visitor_thread(site_key: str, thread: str) -> str:
    return f"visitor:{site_key}:{thread}"


def visitor_context(org: Organization) -> graph.Ctx:
    org_id = org.id
    return graph.Ctx(
        org=org.name,
        filters=access.chunk_filters(access.Visitor(org_id=org_id)),
        scope=lambda lang: visitor_scope(org_id, lang),
        suggested=[],
        threshold=settings.grade_threshold,
        models=VisitorModels(),
        cache=chat_routes.answer_cache,
        org_id=org_id,
        visitor=True,
        greeting=website.greeting(org),
    )


PRUNE_SQL = [
    f"DELETE FROM {table} WHERE thread_id IN (SELECT thread_id FROM checkpoints "
    "WHERE thread_id LIKE 'visitor:%' GROUP BY thread_id "
    "HAVING max((checkpoint->>'ts')::timestamptz) < now() - make_interval(hours => :h))"
    for table in ("checkpoint_writes", "checkpoint_blobs", "checkpoints")  # checkpoints last
]


async def prune_visitor_threads() -> None:
    """Drop visitor thread memory idle for more than 24 h. Runs at most once an hour (on a
    public chat request); the stored messages stay for the admin's conversation list."""
    try:
        if not await redis.set("atlas:pub:prune", "1", nx=True, ex=3600):
            return
        async with Session() as db:
            for sql in PRUNE_SQL:
                await db.execute(text(sql), {"h": settings.visitor_history_h})
            await db.commit()
    except Exception:
        log.exception("visitor thread prune failed")


_background: set[asyncio.Task[None]] = set()


@router.post("/public/{site_key}/chat")
async def public_chat(
    site_key: str, body: PublicChatIn, request: Request, s: DB
) -> StreamingResponse:
    org = await site(s, site_key)
    origin = check_origin(org, request)
    if body.website:
        raise HTTPException(400, "Something went wrong. Please reload the page.")
    question = chat_routes.last_user_text(body.messages)
    if not question:
        raise HTTPException(400, "Type a question first.")
    if len(question) > MAX_QUESTION:
        raise HTTPException(400, f"Please keep the question under {MAX_QUESTION} characters.")
    await rate_limit(
        website.client_ip(request.headers, request.client.host if request.client else None), org.id
    )
    await plans.count_question(org)  # visitors count toward the company's monthly questions

    task = asyncio.create_task(prune_visitor_threads())
    _background.add(task)
    task.add_done_callback(_background.discard)

    chat_id = visitor_chat_id(org.id, body.id)
    tid = visitor_thread(site_key, body.id)
    now = datetime.now(UTC)
    found: Chat | None = await s.get(Chat, chat_id)
    if found is not None and (found.user_id is not None or found.org_id != org.id):
        raise HTTPException(404, "Chat not found.")
    if found is None:
        s.add(Chat(id=chat_id, user_id=None, org_id=org.id, title=question[:120], origin=origin))
    else:
        if now - found.updated_at > timedelta(hours=settings.visitor_history_h):
            await chat_routes.forget_thread(tid)  # memory is kept 24 h
        found.updated_at = now
    s.add(Message(id=uuid.uuid4().hex, chat_id=chat_id, role="user", text=question, created_at=now))
    await s.commit()

    stream = chat_routes.turn_stream(question, visitor_context(org), tid, chat_id)
    r = StreamingResponse(stream, headers=HEADERS)
    cors(r, request, org)
    return r
