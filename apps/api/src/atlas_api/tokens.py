"""Phase 9: service tokens for AI agents (MCP). A token is bound to one person; the agent sees
exactly what that person can see. Only a sha256 hash of the secret is stored."""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, date, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func, select
from sqlalchemy.orm import Mapped, mapped_column, relationship

from atlas_api.db import Session, redis
from atlas_api.models import Base, Role, User

PREFIX = "atl_"
RATE_PER_MIN = 60  # MCP HTTP requests per token per minute


class ApiToken(Base):
    __tablename__ = "api_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user: Mapped[User] = relationship(foreign_keys=[user_id], lazy="joined")


class McpAudit(Base):
    __tablename__ = "mcp_audit"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    token_id: Mapped[int] = mapped_column(
        ForeignKey("api_tokens.id", ondelete="CASCADE"), index=True
    )
    tool: Mapped[str] = mapped_column(String(64))
    args_summary: Mapped[str] = mapped_column(String(300))
    ok: Mapped[bool] = mapped_column(Boolean)
    latency_ms: Mapped[int] = mapped_column(Integer)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


def new_secret() -> str:
    return PREFIX + secrets.token_urlsafe(32)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def verify(raw: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_token(raw), stored_hash)


@dataclass(frozen=True)
class Caller:
    """Who an MCP request acts as: the token and the person it is bound to."""

    token_id: int
    token_name: str
    user: User


def usable(user: User, today: date) -> bool:
    return not (user.role == Role.guest and user.guest_until and user.guest_until < today)


async def authenticate(raw: str) -> Caller | None:
    """The token's person, or None (unknown, revoked, malformed, expired guest)."""
    if not raw.startswith(PREFIX) or len(raw) > 100:
        return None
    digest = hash_token(raw)
    async with Session() as s:
        tok = await s.scalar(select(ApiToken).where(ApiToken.token_hash == digest))
        if tok is None or tok.revoked_at is not None or not verify(raw, tok.token_hash):
            return None
        user = tok.user
        if user.org_id != tok.org_id or not usable(user, date.today()):
            return None
        tok.last_used_at = datetime.now(UTC)
        await s.commit()
        # departments are loaded eagerly (selectin), so the user is safe to use after close
        return Caller(token_id=tok.id, token_name=tok.name, user=user)


async def allow(token_id: int) -> bool:
    """Fixed one-minute window per token in Redis."""
    key = f"mcp:rl:{token_id}:{int(datetime.now(UTC).timestamp() // 60)}"
    n = await redis.incr(key)
    if n == 1:
        await redis.expire(key, 70)
    return int(n) <= RATE_PER_MIN


def summarize(args: dict[str, object]) -> str:
    text = ", ".join(f"{k}={v!r}" for k, v in args.items())
    return text if len(text) <= 300 else text[:297] + "..."


async def audit(caller: Caller, tool: str, args: dict[str, object], ok: bool, ms: int) -> None:
    async with Session() as s:
        s.add(
            McpAudit(
                org_id=caller.user.org_id,
                token_id=caller.token_id,
                tool=tool,
                args_summary=summarize(args),
                ok=ok,
                latency_ms=ms,
            )
        )
        await s.commit()
