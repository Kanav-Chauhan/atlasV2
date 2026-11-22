"""Phase 5 endpoints: /chat (AI SDK UI message stream), chats, feedback, suggestions,
document requests (docs/API.md "Endpoints (Phase 5: answering)")."""

import asyncio
import json
import logging
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from functools import cache
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy import select

from atlas_api import access, graph
from atlas_api.cache import AnswerCache, scope
from atlas_api.db import Session
from atlas_api.models import Chat, DocumentRequest, Message, User
from atlas_api.routes import DB, CurrentUser
from atlas_api.settings import settings
from atlas_api.stream import DONE, HEADERS, sse, ui_parts

log = logging.getLogger(__name__)
router = APIRouter()

ChatId = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{1,64}$")]
answer_cache = AnswerCache() if settings.semantic_cache else None

# ------------------------------------------------------------------ the compiled graph

_graph: Any = None
_saver: Any = None
_lock = asyncio.Lock()


async def compiled() -> Any:
    """The graph with a Postgres checkpointer (same database), built on first use."""
    global _graph, _saver
    async with _lock:
        if _graph is None:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
            from psycopg.rows import dict_row
            from psycopg_pool import AsyncConnectionPool

            pool: AsyncConnectionPool[Any] = AsyncConnectionPool(
                settings.psycopg_url,
                open=False,
                max_size=5,
                kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
            )
            await pool.open()
            _saver = AsyncPostgresSaver(pool)
            await _saver.setup()
            _graph = graph.build(_saver)
    return _graph


def thread_id(user: User, chat_id: str) -> str:
    return f"{user.id}:{chat_id}"  # memory is per user: a chat id alone never reaches it


@cache
def suggested_questions(slug: str) -> dict[str, list[str]]:
    path = Path(settings.corpus_dir) / "orgs" / f"{slug}.json"
    try:
        data: dict[str, list[str]] = json.loads(path.read_text())["suggested_questions"]
    except (OSError, KeyError, ValueError):
        return {}
    return data


def suggested_for(user: User) -> list[str]:
    return suggested_questions(user.org.slug).get(user.email, [])


def context(user: User) -> graph.Ctx:
    depts = set(user.department_names)
    org_id, role = user.org_id, user.role
    return graph.Ctx(
        org=user.org.name,
        filters=access.chunk_filters(user),
        scope=lambda lang: scope(org_id, role, depts, lang),
        suggested=suggested_for(user),
        threshold=settings.grade_threshold,
        cache=answer_cache,
    )


# ------------------------------------------------------------------ /chat


class ChatIn(BaseModel):
    model_config = ConfigDict(extra="ignore")  # trigger, messageId, … from the AI SDK
    id: ChatId
    messages: list[dict[str, Any]]


def last_user_text(messages: list[dict[str, Any]]) -> str:
    for m in reversed(messages):
        if m.get("role") == "user":
            parts = m.get("parts") or []
            return "".join(p.get("text", "") for p in parts if p.get("type") == "text").strip()
    return ""


def meta(m: Message) -> dict[str, Any]:
    out: dict[str, Any] = {
        "route": m.route or "rag",
        "abstained": m.abstained,
        "cached": m.cached,
        "language": m.language or "en",
        "message_id": m.id,
    }
    if m.rewritten_query:
        out["rewritten_query"] = m.rewritten_query
    return out


async def owned_chat(s: Any, user: User, chat_id: str) -> Chat:
    chat: Chat | None = await s.get(Chat, chat_id)
    if chat is None or chat.user_id != user.id:
        raise HTTPException(404, "Chat not found.")
    return chat


@router.post("/chat")
async def chat(body: ChatIn, user: CurrentUser, s: DB) -> StreamingResponse:
    question = last_user_text(body.messages)
    if not question:
        raise HTTPException(400, "Type a question first.")
    if len(question) > 1000:
        raise HTTPException(400, "Please keep the question under 1,000 characters.")
    found: Chat | None = await s.get(Chat, body.id)
    if found is not None and found.user_id != user.id:
        raise HTTPException(404, "Chat not found.")
    now = datetime.now(UTC)
    if found is None:
        s.add(Chat(id=body.id, user_id=user.id, org_id=user.org_id, title=question[:120]))
    else:
        found.updated_at = now
    s.add(Message(id=uuid.uuid4().hex, chat_id=body.id, role="user", text=question, created_at=now))
    await s.commit()

    ctx = context(user)
    tid = thread_id(user, body.id)
    message_id = uuid.uuid4().hex
    chat_id = body.id

    async def run() -> AsyncIterator[str]:
        elapsed = graph.timer()
        final: dict[str, Any] = {}

        async def events() -> AsyncIterator[dict[str, Any]]:
            g = await compiled()
            async for mode, chunk in g.astream(
                graph.new_turn(question),
                config={"configurable": {"thread_id": tid}},
                context=ctx,
                stream_mode=["custom", "values"],
                durability="exit",
            ):
                if mode == "custom":
                    yield chunk
                else:
                    final.clear()
                    final.update(chunk)

        try:
            async for part in ui_parts(events(), message_id):
                yield sse(part)
            query = final.get("query") or ""
            row = Message(
                id=message_id,
                chat_id=chat_id,
                role="assistant",
                text=final.get("answer", ""),
                route=final.get("route") or "rag",
                abstained=bool(final.get("abstained")),
                cached=bool(final.get("cached")),
                rewritten_query=query if query and query != question else None,
                sources=final.get("sources") or [],
                language=final.get("language") or "en",
                latency_ms=elapsed(),
                created_at=datetime.now(UTC),
            )
            async with Session() as db:
                db.add(row)
                await db.commit()
            yield sse({"type": "data-sources", "data": {"sources": row.sources}})
            yield sse({"type": "data-meta", "data": meta(row)})
            yield sse({"type": "finish", "finishReason": "stop"})
            log.info(
                "chat route=%s abstained=%s cached=%s ms=%s",
                row.route,
                row.abstained,
                row.cached,
                row.latency_ms,
            )
        except Exception:
            log.exception("chat turn failed")
            yield sse(
                {
                    "type": "error",
                    "errorText": "Atlas couldn't finish this answer. Please try again.",
                }
            )
        yield DONE

    return StreamingResponse(run(), headers=HEADERS)


# ------------------------------------------------------------------ chats


class ChatSummary(BaseModel):
    id: str
    title: str
    updated_at: datetime


class ChatOut(BaseModel):
    id: str
    title: str
    messages: list[dict[str, Any]]


def ui_message(m: Message) -> dict[str, Any]:
    if m.role == "user":
        return {"id": m.id, "role": "user", "parts": [{"type": "text", "text": m.text}]}
    return {
        "id": m.id,
        "role": "assistant",
        "parts": [
            {"type": "text", "text": m.text, "state": "done"},
            {"type": "data-sources", "data": {"sources": m.sources}},
            {"type": "data-meta", "data": meta(m)},
        ],
    }


@router.get("/chats")
async def list_chats(user: CurrentUser, s: DB) -> list[ChatSummary]:
    chats = await s.scalars(
        select(Chat).where(Chat.user_id == user.id).order_by(Chat.updated_at.desc()).limit(200)
    )
    return [ChatSummary(id=c.id, title=c.title, updated_at=c.updated_at) for c in chats]


@router.get("/chats/{chat_id}")
async def get_chat(chat_id: ChatId, user: CurrentUser, s: DB) -> ChatOut:
    c = await owned_chat(s, user, chat_id)
    rows = await s.scalars(
        select(Message).where(Message.chat_id == c.id).order_by(Message.created_at, Message.id)
    )
    return ChatOut(id=c.id, title=c.title, messages=[ui_message(m) for m in rows])


@router.delete("/chats/{chat_id}", status_code=204)
async def delete_chat(chat_id: ChatId, user: CurrentUser, s: DB) -> Response:
    c = await owned_chat(s, user, chat_id)
    await s.delete(c)
    await s.commit()
    await compiled()
    await _saver.adelete_thread(thread_id(user, chat_id))
    return Response(status_code=204)


# ------------------------------------------------------------------ feedback, suggestions


class FeedbackIn(BaseModel):
    message_id: Annotated[str, StringConstraints(max_length=64)]
    value: Literal["up", "down"]
    comment: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None


@router.post("/feedback", status_code=204)
async def feedback(body: FeedbackIn, user: CurrentUser, s: DB) -> Response:
    m = await s.scalar(
        select(Message)
        .join(Chat, Chat.id == Message.chat_id)
        .where(Message.id == body.message_id, Message.role == "assistant", Chat.user_id == user.id)
    )
    if m is None:
        raise HTTPException(404, "That answer was not found.")
    m.feedback, m.comment = body.value, body.comment
    await s.commit()
    return Response(status_code=204)


@router.get("/me/suggested")
async def me_suggested(user: CurrentUser) -> dict[str, list[str]]:
    return {"questions": suggested_for(user)}


Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class RequestIn(BaseModel):
    question: Text
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None


@router.post("/documents/request", status_code=204)
async def request_document(body: RequestIn, user: CurrentUser, s: DB) -> Response:
    s.add(
        DocumentRequest(org_id=user.org_id, user_id=user.id, question=body.question, note=body.note)
    )
    await s.commit()
    return Response(status_code=204)
