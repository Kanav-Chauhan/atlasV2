"""Super admin (the Atlas owner): login with an argon2-checked password, a signed `atlas_super`
cookie, and the /super/* pages (docs/API.md "Super admin")."""

import hashlib
import hmac
import logging
import re
import time
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

import httpx
from argon2 import PasswordHasher
from argon2.exceptions import Argon2Error, InvalidHashError
from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, StringConstraints
from sqlalchemy import case, func, select

from atlas_api.db import redis
from atlas_api.insights_routes import insights_for
from atlas_api.models import (
    AnswerEvalRun,
    Chat,
    Document,
    EvalRun,
    Message,
    Organization,
    Role,
    User,
)
from atlas_api.routes import DB, DocumentOut
from atlas_api.settings import settings
from atlas_api.team_routes import org_people, person

log = logging.getLogger(__name__)
router = APIRouter()
COOKIE = "atlas_super"
TTL_S = 8 * 3600
ATTEMPTS_PER_MIN = 5
_hasher = PasswordHasher()


def sign(expires: int) -> str:
    msg = f"super|{expires}".encode()
    return hmac.new(settings.session_secret.encode(), msg, hashlib.sha256).hexdigest()


def make_token(now: float | None = None) -> str:
    expires = int(now if now is not None else time.time()) + TTL_S
    return f"{expires}.{sign(expires)}"


def token_ok(token: str | None) -> bool:
    if not token or not settings.session_secret:
        return False
    expires, _, sig = token.partition(".")
    return (
        expires.isdigit()
        and hmac.compare_digest(sig, sign(int(expires)))
        and int(expires) > time.time()
    )


def password_ok(email: str, password: str) -> bool:
    if not (settings.superadmin_email and settings.superadmin_password_hash):
        return False
    try:
        ok: bool = _hasher.verify(settings.superadmin_password_hash, password)
    except (Argon2Error, InvalidHashError):
        ok = False
    # Verify first, compare email after: a wrong email costs the same time as a wrong password.
    return ok and hmac.compare_digest(email.lower(), settings.superadmin_email.lower())


def client_ip(request: Request) -> str:
    # Caddy replaces X-Forwarded-For with the real client IP (untrusted upstream values are
    # dropped); Next appends to it. Direct callers only reach the API on 127.0.0.1.
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "?")


class SuperLogin(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=320)]
    password: Annotated[str, StringConstraints(max_length=1000)]


@router.post("/auth/super", status_code=204)
async def super_login(body: SuperLogin, request: Request) -> Response:
    key = f"atlas:super_login:{client_ip(request)}"
    attempts = await redis.incr(key)
    if attempts == 1:
        await redis.expire(key, 60)
    if attempts > ATTEMPTS_PER_MIN:
        raise HTTPException(429, "Too many attempts. Try again in a minute.")
    if not settings.session_secret or not password_ok(body.email, body.password):
        log.warning("super admin login failed from %s", client_ip(request))  # never the password
        raise HTTPException(401, "Wrong email or password.")
    response = Response(status_code=204)
    response.set_cookie(
        COOKIE, make_token(), max_age=TTL_S, httponly=True, secure=True, samesite="strict"
    )
    return response


@router.post("/auth/super/logout", status_code=204)
async def super_logout() -> Response:
    response = Response(status_code=204)
    response.delete_cookie(COOKIE, httponly=True, secure=True, samesite="strict")
    return response


def super_admin(atlas_super: Annotated[str | None, Cookie()] = None) -> None:
    if not token_ok(atlas_super):
        raise HTTPException(401, "Super admin login required.")


Super = Depends(super_admin)
Days = Annotated[int, Query(ge=1, le=365)]


@router.get("/super/orgs", dependencies=[Super])
async def super_orgs(s: DB) -> list[dict[str, Any]]:
    since = datetime.now(UTC) - timedelta(days=30)
    people = dict(
        (await s.execute(select(User.org_id, func.count()).group_by(User.org_id))).tuples().all()
    )
    docs = {
        o: (n, c or 0)
        for o, n, c in await s.execute(
            select(Document.org_id, func.count(), func.sum(Document.chunks)).group_by(
                Document.org_id
            )
        )
    }
    assistant = Message.role == "assistant"
    asked = {
        o: (q, nf, rq, last)
        for o, q, nf, rq, last in await s.execute(
            select(
                Chat.org_id,
                func.count().filter(assistant, Message.created_at >= since),
                func.count().filter(assistant, Message.abstained, Message.created_at >= since),
                func.count().filter(
                    assistant,
                    func.coalesce(Message.route, "rag") == "rag",
                    Message.created_at >= since,
                ),
                func.max(Message.created_at),
            )
            .join(Message, Message.chat_id == Chat.id)
            .group_by(Chat.org_id)
        )
    }
    out = []
    for org in await s.scalars(select(Organization).order_by(Organization.name)):
        q, nf, rq, last = asked.get(org.id, (0, 0, 0, None))
        n_docs, chunks = docs.get(org.id, (0, 0))
        out.append(
            {
                "slug": org.slug,
                "name": org.name,
                "people": people.get(org.id, 0),
                "documents": n_docs,
                "chunks": int(chunks),
                "questions_30d": q,
                "not_found_pct_30d": round(100 * nf / rq, 1) if rq else None,
                "last_activity": last,
            }
        )
    return out


@router.get("/super/evals", dependencies=[Super])
async def super_evals(s: DB) -> list[dict[str, Any]]:
    """Retrieval runs (kind "retrieval", per-mode `modes`) and answer runs (kind "answers",
    `summary`), newest first."""
    runs: list[dict[str, Any]] = [
        {"kind": "retrieval", "run_id": r.run_id, "created_at": r.created_at, "modes": r.modes}
        for r in await s.scalars(select(EvalRun))
    ]
    runs += [
        {"kind": "answers", "run_id": r.run_id, "created_at": r.created_at, "summary": r.summary}
        for r in await s.scalars(select(AnswerEvalRun))
    ]
    return sorted(runs, key=lambda r: r["created_at"], reverse=True)


@router.get("/super/usage", dependencies=[Super])
async def super_usage(s: DB, days: Days = 30) -> list[dict[str, Any]]:
    since = datetime.now(UTC) - timedelta(days=days)
    # shortcut: messages don't store the model or token counts yet; model is the gateway slot
    # by route ("smart" answers RAG, otherwise no answer model). Add columns when Phase 6 logs them.
    model = case((func.coalesce(Message.route, "rag") == "rag", "smart"), else_="none")
    rows = await s.execute(
        select(Organization.slug, model, func.count(), func.avg(Message.latency_ms))
        .join(Chat, Chat.org_id == Organization.id)
        .join(Message, Message.chat_id == Chat.id)
        .where(Message.role == "assistant", Message.created_at >= since)
        .group_by(Organization.slug, model)
        .order_by(Organization.slug)
    )
    return [
        {
            "org": slug,
            "model": m,
            "questions": n,
            "tokens_in": None,
            "tokens_out": None,
            "avg_latency_ms": round(avg) if avg is not None else None,
        }
        for slug, m, n, avg in rows
    ]


@router.get("/super/waitlist", dependencies=[Super])
async def super_waitlist() -> list[dict[str, Any]]:
    from atlas_api import waitlist

    try:
        return await waitlist.entries()
    except httpx.HTTPError as e:
        raise HTTPException(502, "Clerk did not answer. Try again in a minute.") from e


@router.post("/super/waitlist/{entry_id}/invite", status_code=204, dependencies=[Super])
async def super_waitlist_invite(entry_id: str) -> Response:
    """Invite one waitlist entry (Clerk emails them a sign-up link that works in Waitlist mode)."""
    from atlas_api import clerk

    if not re.fullmatch(r"[A-Za-z0-9_]{1,64}", entry_id):
        raise HTTPException(404, "Waitlist entry not found.")
    if not settings.clerk_secret_key:
        raise HTTPException(503, "Clerk is not set up.")
    try:
        await clerk.invite_waitlist_entry(entry_id)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(404, "Waitlist entry not found.") from e
        raise HTTPException(502, "Clerk did not accept the invitation. Try again.") from e
    except httpx.HTTPError as e:
        raise HTTPException(502, "Clerk did not answer. Try again in a minute.") from e
    return Response(status_code=204)


@router.get("/super/orgs/{slug}/view", dependencies=[Super])
async def super_org_view(slug: str, s: DB) -> dict[str, Any]:
    org = await s.scalar(select(Organization).where(Organization.slug == slug))
    if org is None:
        raise HTTPException(404, "Company not found.")
    viewer = User(id=0, org_id=org.id, role=Role.admin)  # read-only stand-in, never saved
    docs = await s.scalars(
        select(Document).where(Document.org_id == org.id).order_by(Document.updated_at.desc())
    )
    return {
        "org": {
            "slug": org.slug,
            "name": org.name,
            "industry": org.industry,
            "description": org.description,
        },
        "team": [person(u) for u in await org_people(s, viewer)],
        "documents": [DocumentOut.model_validate(d) for d in docs],
        "insights": await insights_for(s, viewer, 30),
    }
