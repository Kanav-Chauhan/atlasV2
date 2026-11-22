"""Phase 10 waitlist: "Join the Pro waitlist" on the landing page → Clerk Waitlist.

Emails are stored in Clerk only (Backend API /v1/waitlist_entries); the owner approves and
invites people from the Clerk Dashboard. Atlas keeps no copy. Without ATLAS_CLERK_SECRET_KEY
the form answers 503 and the super admin list is empty.
"""

import re
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from atlas_api import website
from atlas_api.settings import settings
from atlas_api.website_routes import under_limit

CLERK_API = "https://api.clerk.com/v1"
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PER_IP_PER_HOUR = 5

router = APIRouter()


class WaitlistIn(BaseModel):
    email: str = Field(max_length=254)
    website: str = ""  # honeypot: people never see it, bots fill it


def headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.clerk_secret_key}"}


async def add(email: str) -> None:
    """Add one email (Clerk returns the existing entry for a repeat, so it is idempotent)."""
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{CLERK_API}/waitlist_entries",
            headers=headers(),
            json={"email_address": email, "notify": True},
        )
    if r.status_code == 422:
        raise HTTPException(422, "That address looks incomplete. Write it as name@example.com.")
    r.raise_for_status()


async def entries(limit: int = 100) -> list[dict[str, Any]]:
    """Newest first: [{email, status, created_at}]."""
    if not settings.clerk_secret_key:
        return []
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            f"{CLERK_API}/waitlist_entries",
            headers=headers(),
            params={"limit": limit, "order_by": "-created_at"},
        )
    r.raise_for_status()
    return [
        {"email": e["email_address"], "status": e["status"], "created_at": e["created_at"]}
        for e in r.json()["data"]
    ]


@router.post("/public/waitlist", status_code=204)
async def join(body: WaitlistIn, request: Request) -> Response:
    if body.website:
        raise HTTPException(400, "Leave the website field empty.")
    email = body.email.strip().lower()
    if not EMAIL.match(email):
        raise HTTPException(422, "That address looks incomplete. Write it as name@example.com.")
    if not settings.clerk_secret_key:
        raise HTTPException(503, "The waitlist is not open yet.")
    ip = website.client_ip(request.headers, request.client.host if request.client else None)
    if not await under_limit(f"waitlist:ip:{ip}", PER_IP_PER_HOUR, 3600):
        raise HTTPException(429, "Too many tries from here. Try again in an hour.")
    try:
        await add(email)
    except httpx.HTTPError as e:
        raise HTTPException(502, "That did not go through. Try again in a minute.") from e
    return Response(status_code=204)
