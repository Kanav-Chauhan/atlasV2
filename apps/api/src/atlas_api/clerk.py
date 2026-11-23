"""Real sign-in with Clerk (Phase 10, docs/API.md "Who is calling").

The browser holds a Clerk session; its short-lived session JWT reaches the API either as the
same-site `__session` cookie (browser → Next /api rewrite → API) or as `Authorization: Bearer`
(Next server components → API). `verify()` checks it without a network call per request: the
signing keys come from the instance's JWKS (fetched once, cached for an hour), then signature,
issuer, exp/nbf/iat and `azp` (must be the Atlas origin) are checked locally.

A verified Clerk user maps to `users.clerk_user_id`. The first time a Clerk user is seen, they
are linked to an existing Atlas person (added on Team & access, or invited) by Clerk's **verified
primary email** only; demo-company people are never linked. Nobody found → onboarding.
"""

import base64
import logging
from functools import lru_cache
from typing import Any

import httpx
import jwt
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from atlas_api.models import Organization, User
from atlas_api.settings import settings

log = logging.getLogger(__name__)
CLERK_API = "https://api.clerk.com/v1"
LEEWAY_S = 5  # clock skew between Clerk and this server


def frontend_api(publishable_key: str) -> str | None:
    """pk_live_<base64("clerk.kanav.space$")> → "clerk.kanav.space"."""
    _, _, encoded = publishable_key.partition("_")
    encoded = encoded.partition("_")[2]
    try:
        host = base64.b64decode(encoded + "=" * (-len(encoded) % 4)).decode()
    except ValueError:
        return None
    return host[:-1] if host.endswith("$") and "." in host else None


def issuer() -> str | None:
    host = frontend_api(settings.clerk_publishable_key) if settings.clerk_publishable_key else None
    return f"https://{host}" if host else None


def authorized_parties() -> set[str]:
    return {settings.app_origin.rstrip("/")}


@lru_cache(maxsize=4)
def _jwks(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600, timeout=10)


def signing_key(token: str, iss: str) -> Any:
    """Public key for this token's `kid` (blocking on a JWKS cache miss; tests replace this)."""
    return _jwks(f"{iss}/.well-known/jwks.json").get_signing_key_from_jwt(token).key


async def verify(token: str) -> dict[str, Any] | None:
    """The session claims of a valid Clerk session JWT, else None (never raises)."""
    iss = issuer()
    if not iss or token.count(".") != 2:
        return None
    try:
        if jwt.get_unverified_header(token).get("alg") != "RS256":
            return None
        key = await run_in_threadpool(signing_key, token, iss)
        claims: dict[str, Any] = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=iss,
            leeway=LEEWAY_S,
            options={"require": ["exp", "iat", "sub", "iss", "azp"], "verify_aud": False},
        )
    except (jwt.PyJWTError, httpx.HTTPError, OSError) as e:
        log.info("clerk token rejected: %s", type(e).__name__)
        return None
    if claims.get("azp", "").rstrip("/") not in authorized_parties():
        log.info("clerk token rejected: azp %r", claims.get("azp"))
        return None
    if not str(claims["sub"]).startswith("user_"):
        return None
    return claims


# ------------------------------------------------------------------ Backend API


def headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.clerk_secret_key}"}


async def get_user(clerk_user_id: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{CLERK_API}/users/{clerk_user_id}", headers=headers())
    r.raise_for_status()
    data: dict[str, Any] = r.json()
    return data


def verified_primary_email(clerk_user: dict[str, Any]) -> str | None:
    """The primary email, lower-cased, only if Clerk verified it."""
    primary = clerk_user.get("primary_email_address_id")
    for e in clerk_user.get("email_addresses") or []:
        if e.get("id") == primary:
            if (e.get("verification") or {}).get("status") == "verified":
                return str(e["email_address"]).strip().lower()
            return None
    return None


def display_name(clerk_user: dict[str, Any], email: str) -> str:
    name = " ".join(
        p for p in (clerk_user.get("first_name"), clerk_user.get("last_name")) if p
    ).strip()
    return name or email.split("@")[0]


async def invite(email: str) -> str:
    """Clerk invitation for a person added on Team & access, so they can sign up even while
    sign-up is in Waitlist mode. Returns "sent" or "exists" (already a Clerk user)."""
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{CLERK_API}/invitations",
            headers=headers(),
            json={
                "email_address": email,
                "redirect_url": f"{settings.app_origin}/sign-up",
                "notify": True,
                "ignore_existing": True,
            },
        )
    if r.status_code in (400, 422) and any(
        "exists" in str(e.get("code", "")) for e in (r.json().get("errors") or [])
    ):
        return "exists"  # e.g. form_identifier_exists: they already have a Clerk login
    r.raise_for_status()
    return "sent"


async def invite_waitlist_entry(entry_id: str) -> None:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{CLERK_API}/waitlist_entries/{entry_id}/invite",
            headers=headers(),
            json={"ignore_existing": True},
        )
    r.raise_for_status()


# ------------------------------------------------------------------ Clerk user → Atlas person


async def linked_user(s: AsyncSession, clerk_user_id: str) -> User | None:
    user: User | None = await s.scalar(select(User).where(User.clerk_user_id == clerk_user_id))
    return user


async def link_by_email(s: AsyncSession, clerk_user_id: str, email: str) -> User | None:
    """Link the not-yet-linked, non-demo person with this (verified) email, if there is one."""
    user: User | None = await s.scalar(
        select(User)
        .join(Organization, Organization.id == User.org_id)
        .where(
            func.lower(User.email) == email,
            User.clerk_user_id.is_(None),
            Organization.plan != "demo",
        )
    )
    if user is not None:
        user.clerk_user_id = clerk_user_id
        await s.commit()
        log.info("linked clerk user %s to atlas user %s", clerk_user_id, user.id)
    return user


async def resolve(s: AsyncSession, clerk_user_id: str) -> User | None:
    """The Atlas person for a verified Clerk user: linked already, or linked now by email."""
    user = await linked_user(s, clerk_user_id)
    if user is not None:
        return user
    if not settings.clerk_secret_key:
        return None
    try:
        email = verified_primary_email(await get_user(clerk_user_id))
    except httpx.HTTPError as e:
        log.warning("clerk user lookup failed: %s", type(e).__name__)
        return None
    return await link_by_email(s, clerk_user_id, email) if email else None
