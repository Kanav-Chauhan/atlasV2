"""Phase 9 token admin (docs/API.md "Endpoints (Phase 9: MCP server)"): admin only, same org."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, StringConstraints
from sqlalchemy import func, select

from atlas_api import profile_routes
from atlas_api.models import User
from atlas_api.routes import DB
from atlas_api.team_routes import Admin
from atlas_api.tokens import ApiToken, McpAudit, hash_token, new_secret

router = APIRouter()

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class TokenUser(BaseModel):
    id: int
    name: str
    email: str
    avatar_url: str | None = None


class TokenOut(BaseModel):
    id: int
    name: str
    user: TokenUser
    created_at: datetime
    last_used_at: datetime | None
    revoked: bool


class TokenIn(BaseModel):
    name: Name
    user_id: int


class TokenCreated(BaseModel):
    id: int
    name: str
    token: str


class AuditOut(BaseModel):
    at: datetime
    token_name: str
    user_email: str
    tool: str
    args_summary: str
    ok: bool
    latency_ms: int


@router.get("/tokens")
async def list_tokens(user: Admin, s: DB) -> list[TokenOut]:
    toks = await s.scalars(
        select(ApiToken)
        .where(ApiToken.org_id == user.org_id)
        .order_by(ApiToken.revoked_at.is_not(None), ApiToken.created_at.desc())
    )
    return [
        TokenOut(
            id=t.id,
            name=t.name,
            user=TokenUser(
                id=t.user.id,
                name=t.user.name,
                email=t.user.email,
                avatar_url=profile_routes.avatar_url(t.user),
            ),
            created_at=t.created_at,
            last_used_at=t.last_used_at,
            revoked=t.revoked_at is not None,
        )
        for t in toks
    ]


@router.post("/tokens", status_code=201)
async def create_token(body: TokenIn, user: Admin, s: DB) -> TokenCreated:
    person = await s.get(User, body.user_id)
    if person is None or person.org_id != user.org_id:
        raise HTTPException(404, "That person isn't in your company.")
    secret = new_secret()
    tok = ApiToken(
        org_id=user.org_id,
        user_id=person.id,
        name=body.name,
        token_hash=hash_token(secret),
        created_by=user.id,
    )
    s.add(tok)
    await s.commit()
    return TokenCreated(id=tok.id, name=tok.name, token=secret)


@router.delete("/tokens/{token_id}", status_code=204)
async def revoke_token(token_id: int, user: Admin, s: DB) -> Response:
    tok = await s.get(ApiToken, token_id)
    if tok is None or tok.org_id != user.org_id:
        raise HTTPException(404, "Token not found.")
    if tok.revoked_at is None:
        tok.revoked_at = datetime.now(UTC)
        await s.commit()
    return Response(status_code=204)


TOOLS = ("search_knowledge", "ask_question", "get_document", "list_departments")


class AuditPage(BaseModel):
    items: list[AuditOut]
    total: int
    page: int
    per_page: int
    tools: list[str]


@router.get("/tokens/audit")
async def token_audit(
    user: Admin,
    s: DB,
    days: Annotated[int, Query(ge=1, le=365)] = 7,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 25,
    token: Annotated[int | None, Query(ge=1)] = None,
    tool: Annotated[str | None, Query(max_length=64)] = None,
) -> AuditPage:
    """Newest first, one page at a time. Filters: token id, tool name, last `days` days."""
    since = datetime.now(UTC) - timedelta(days=days)
    where = [McpAudit.org_id == user.org_id, McpAudit.at >= since]
    if token is not None:
        where.append(McpAudit.token_id == token)
    if tool:
        where.append(McpAudit.tool == tool)
    total = await s.scalar(select(func.count()).select_from(McpAudit).where(*where)) or 0
    rows = await s.execute(
        select(McpAudit, ApiToken.name, User.email)
        .join(ApiToken, ApiToken.id == McpAudit.token_id)
        .join(User, User.id == ApiToken.user_id)
        .where(*where)
        .order_by(McpAudit.at.desc(), McpAudit.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    return AuditPage(
        items=[
            AuditOut(
                at=a.at,
                token_name=name,
                user_email=email,
                tool=a.tool,
                args_summary=a.args_summary,
                ok=a.ok,
                latency_ms=a.latency_ms,
            )
            for a, name, email in rows
        ],
        total=total,
        page=page,
        per_page=per_page,
        tools=list(TOOLS),
    )
