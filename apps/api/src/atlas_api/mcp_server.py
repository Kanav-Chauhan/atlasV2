"""Phase 9: Atlas as an MCP server (docs/API.md "Endpoints (Phase 9: MCP server)").

Streamable HTTP at `/mcp`, stateless + JSON responses (each request stands alone, so it works
behind the Next.js `/api/*` rewrite and Caddy). Every request needs `Authorization: Bearer atl_…`;
the token is bound to one person, and every tool uses that person's access.py filters.
`ask_question` runs the full answer flow (graph.py, no chat history) and returns the cited answer.
"""

import asyncio
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.streamable_http_manager import StreamableHTTPASGIApp
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.types import Receive, Scope, Send

from atlas_api import access, plans, tokens
from atlas_api.db import CHUNKS_TABLE, Session
from atlas_api.models import EVERYONE, Department, Document, Role, Status, User
from atlas_api.settings import settings

MAX_DOC_CHARS = 20_000
CALLER = "atlas_caller"  # key in the ASGI scope state set by BearerAuth

mcp = MCPServer(
    name="atlas",
    title="Atlas",
    version="2",
    instructions=(
        "Atlas is a company knowledge base. ask_question returns a cited answer; "
        "search_knowledge finds passages in the documents this token's person may read; "
        "get_document opens one; list_departments shows what can be searched. "
        "Cite the document title and doc_no when you use a passage."
    ),
)


# ---------------------------------------------------------------- auth (plain ASGI wrapper)


def _reply(status: int, detail: str) -> JSONResponse:
    headers = {"WWW-Authenticate": 'Bearer realm="atlas"'} if status == 401 else None
    return JSONResponse({"detail": detail}, status_code=status, headers=headers)


class BearerAuth:
    """Resolves the bearer token to a Caller before the MCP transport sees the request."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        scheme, _, raw = Headers(scope=scope).get("authorization", "").partition(" ")
        caller = await tokens.authenticate(raw.strip()) if scheme.lower() == "bearer" else None
        if caller is None:
            return await _reply(401, "Missing, invalid or revoked token.")(scope, receive, send)
        if not await tokens.allow(caller.token_id):
            return await _reply(429, "Too many requests for this token; wait a minute.")(
                scope, receive, send
            )
        scope.setdefault("state", {})[CALLER] = caller
        await StreamableHTTPASGIApp(mcp.session_manager)(scope, receive, send)


# Registered in main.py as a plain route (a Mount would 307-redirect /mcp to /mcp/).
route = Route("/mcp", endpoint=BearerAuth())


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # A fresh session manager per app start (run() works once per manager).
    mcp.streamable_http_app(
        stateless_http=True,
        json_response=True,
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    async with mcp.session_manager.run():
        yield


def caller_of(ctx: Context) -> tokens.Caller:
    request = ctx.request_context.request
    caller = getattr(request, "scope", {}).get("state", {}).get(CALLER)
    if not isinstance(caller, tokens.Caller):  # never reached through BearerAuth
        raise ToolError("Not authenticated.")
    return caller


async def audited[T](
    ctx: Context, tool: str, args: dict[str, object], fn: Callable[[User], Awaitable[T]]
) -> T:
    """Run one tool as the token's person and write an audit row (ok or not)."""
    caller = caller_of(ctx)
    start = time.perf_counter()
    ok = False
    try:
        result = await fn(caller.user)
        ok = True
        return result
    finally:
        await tokens.audit(caller, tool, args, ok, round((time.perf_counter() - start) * 1000))


# ---------------------------------------------------------------- tools


class Passage(BaseModel):
    title: str
    doc_no: str
    department: str
    page: int | None
    section: str
    text: str
    document_id: int
    score: float


class SearchResult(BaseModel):
    passages: list[Passage]
    abstained: bool = Field(description="True when no passage is good enough to answer from.")


def run_search(q: str, user: User, top_k: int) -> SearchResult:
    """retrieve.search (hybrid_rerank) with the person's filters; swappable in tests."""
    from atlas_api import retrieve

    hits = retrieve.search(q, access.chunk_filters(user), "hybrid_rerank", top_k).final
    if not hits or (hits[0].score or 0.0) < settings.grade_threshold:
        return SearchResult(passages=[], abstained=True)
    return SearchResult(
        passages=[
            Passage(
                title=n.node.metadata.get("title", ""),
                doc_no=n.node.metadata.get("doc_no", ""),
                department=n.node.metadata.get("access", ""),
                page=n.node.metadata.get("page"),
                section=n.node.metadata.get("header_path", "/"),
                text=n.node.get_content(),
                document_id=int(n.node.ref_doc_id or 0),
                score=round(n.score or 0.0, 4),
            )
            for n in hits
        ],
        abstained=False,
    )


@mcp.tool()
async def search_knowledge(query: str, ctx: Context, top_k: int = 5) -> SearchResult:
    """Search the company documents this token's person may read. Returns the best passages
    with their document title, doc_no, department, page and section."""
    q = query.strip()[:1000]
    if not q:
        raise ToolError("query is empty.")
    k = max(1, min(top_k, 20))

    async def go(user: User) -> SearchResult:
        return await asyncio.to_thread(run_search, q, user, k)

    return await audited(ctx, "search_knowledge", {"query": q, "top_k": k}, go)


class Source(BaseModel):
    n: int = Field(description="The [n] marker used in the answer.")
    title: str
    doc_no: str | None
    page: int | None
    section: str | None
    document_id: int


class Answer(BaseModel):
    answer: str
    sources: list[Source]
    abstained: bool = Field(description="True when Atlas found nothing good enough to answer.")


_graph: Any = None


async def run_ask(q: str, user: User) -> Answer:
    """The Ask flow (graph.py) as the person, one fresh turn; swappable in tests."""
    import uuid

    from atlas_api import chat_routes, graph

    global _graph
    if _graph is None:
        _graph = graph.build()  # no checkpointer: every call is a fresh chat
    config = {"configurable": {"thread_id": f"mcp:{uuid.uuid4().hex}"}}
    final = await _graph.ainvoke(
        graph.new_turn(q), config=config, context=chat_routes.context(user)
    )
    return Answer(
        answer=final.get("answer", ""),
        sources=[
            Source(
                n=int(p.get("n") or i),
                title=p.get("title", ""),
                doc_no=p.get("doc_no"),
                page=p.get("page"),
                section=p.get("section"),
                document_id=int(p.get("document_id") or 0),
            )
            for i, p in enumerate(final.get("sources", []), 1)
        ],
        abstained=bool(final.get("abstained")),
    )


@mcp.tool()
async def ask_question(question: str, ctx: Context) -> Answer:
    """Ask Atlas a question about the company documents this token's person may read. Returns
    a short answer with [n] citations and the cited sources, or abstained=true when the
    documents do not answer it. Slower than search_knowledge (it runs the full answer flow)."""
    q = question.strip()[:1000]
    if not q:
        raise ToolError("question is empty.")

    async def go(user: User) -> Answer:
        try:
            await plans.count_question(user.org)
        except HTTPException as e:
            raise ToolError(str(e.detail)) from e
        return await run_ask(q, user)

    return await audited(ctx, "ask_question", {"question": q}, go)


class DocumentText(BaseModel):
    title: str
    doc_no: str
    department: str
    text: str
    truncated: bool


def join_chunks(parts: list[str]) -> str:
    """Rebuild a document from its chunks, dropping the splitter's overlap between neighbours."""
    out = ""
    for part in parts:
        head = part[:40]
        at = out.rfind(head, max(0, len(out) - 4000)) if out and len(head) == 40 else -1
        if at >= 0 and part.startswith(out[at:]):
            out += part[len(out) - at :]
        else:
            out += ("\n\n" if out else "") + part
    return out


@mcp.tool()
async def get_document(document_id: int, ctx: Context) -> DocumentText:
    """Open one document (Markdown text, truncated to a safe length) by its document_id."""

    async def go(user: User) -> DocumentText:
        async with Session() as s:
            doc = await s.get(Document, document_id)
            if doc is None or doc.status != Status.ready or not access.can_read(user, doc):
                raise ToolError("Document not found.")
            rows = await s.execute(
                text(
                    f"SELECT text FROM {CHUNKS_TABLE}"
                    " WHERE metadata_->>'document_id' = :id ORDER BY id"
                ),
                {"id": str(doc.id)},
            )
            body = join_chunks([r[0] for r in rows])
        return DocumentText(
            title=doc.title,
            doc_no=doc.doc_no or "",
            department=doc.access,
            text=body[:MAX_DOC_CHARS],
            truncated=len(body) > MAX_DOC_CHARS,
        )

    return await audited(ctx, "get_document", {"document_id": document_id}, go)


class DepartmentCount(BaseModel):
    name: str
    documents: int


class Departments(BaseModel):
    departments: list[DepartmentCount]


def readable_departments(user: User, names: list[str]) -> list[str]:
    if user.role == Role.admin:
        return [EVERYONE, *names]
    return [EVERYONE, *(n for n in names if n in user.department_names)]


@mcp.tool()
async def list_departments(ctx: Context) -> Departments:
    """The departments this token's person can read, with how many documents each has."""

    async def go(user: User) -> Departments:
        async with Session() as s:
            names = list(
                await s.scalars(
                    select(Department.name)
                    .where(Department.org_id == user.org_id)
                    .order_by(Department.name)
                )
            )
            rows = await s.execute(
                select(Document.access, func.count())
                .where(access.readable(user), Document.status == Status.ready)
                .group_by(Document.access)
            )
            counts = {a: int(c) for a, c in rows}
        return Departments(
            departments=[
                DepartmentCount(name=n, documents=int(counts.get(n, 0)))
                for n in readable_departments(user, names)
            ]
        )

    return await audited(ctx, "list_departments", {}, go)
