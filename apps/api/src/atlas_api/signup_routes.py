"""Onboarding for real sign-ins (Phase 10): a Clerk user with no Atlas person creates their
company and becomes its Admin. Invited people never see this: they link by email (clerk.py)."""

import re
import secrets
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, StringConstraints
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from atlas_api import clerk, website
from atlas_api.models import Organization, Role, User
from atlas_api.routes import DB, session_token

router = APIRouter()
NEW_ORG_PLAN = "pro"  # until payments (PLAN.md §8): every new company starts on Pro


async def clerk_claims(request: Request) -> dict[str, Any]:
    token = session_token(request)
    claims = await clerk.verify(token) if token else None
    if claims is None:
        raise HTTPException(401, "Please sign in.")
    return claims


Claims = Annotated[dict[str, Any], Depends(clerk_claims)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


class OnboardingIn(BaseModel):
    company: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    industry: Text = ""


class OnboardingOut(BaseModel):
    linked: bool
    email: str | None = None
    name: str | None = None
    org: str | None = None  # slug, once linked


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40].strip("-")
    return slug or "company"


async def free_slug(s: AsyncSession, name: str) -> str:
    base = slugify(name)
    slug = base
    while slug in website.DEMO_SLUGS or await s.scalar(
        select(Organization.id).where(Organization.slug == slug)
    ):
        slug = f"{base}-{secrets.token_hex(2)}"
    return slug


async def clerk_profile(clerk_user_id: str) -> tuple[str, str]:
    """(verified primary email, display name) from Clerk; 403 without a verified email."""
    try:
        cu = await clerk.get_user(clerk_user_id)
    except httpx.HTTPError as e:
        raise HTTPException(502, "Sign-in service did not answer. Try again in a minute.") from e
    email = clerk.verified_primary_email(cu)
    if not email:
        raise HTTPException(403, "Verify your email address first.")
    return email, clerk.display_name(cu, email)


async def onboard(
    s: AsyncSession, clerk_user_id: str, email: str, name: str, company: str, industry: str
) -> tuple[User, bool]:
    """(person, created). Idempotent: a Clerk user who already has (or can be linked to) a
    person gets that person back and nothing new is made."""
    user = await clerk.linked_user(s, clerk_user_id) or await clerk.link_by_email(
        s, clerk_user_id, email
    )
    if user is not None:
        return user, False
    if await s.scalar(select(User.id).where(User.email == email)):
        # Same email at a demo company or already linked to another Clerk user.
        raise HTTPException(409, "This email already belongs to another Atlas login.")
    try:
        org = Organization(
            slug=await free_slug(s, company),
            name=company,
            industry=industry,
            description="",
            plan=NEW_ORG_PLAN,
            website_chat={},
        )
        s.add(org)
        await s.flush()
        user = User(
            org_id=org.id,
            email=email,
            name=name,
            title="",
            role=Role.admin,
            clerk_user_id=clerk_user_id,
            departments=[],
        )
        s.add(user)
        await s.commit()
    except IntegrityError:
        # A second submit raced this one (same slug, email or Clerk id): keep the first.
        await s.rollback()
        user = await clerk.linked_user(s, clerk_user_id)
        if user is None:
            raise HTTPException(409, "This email already belongs to another Atlas login.") from None
        return user, False
    await s.refresh(user, ["org"])
    return user, True


@router.get("/onboarding")
async def onboarding_state(claims: Claims, s: DB) -> OnboardingOut:
    user = await clerk.resolve(s, claims["sub"])
    if user is not None:
        return OnboardingOut(linked=True, email=user.email, name=user.name, org=user.org.slug)
    email, name = await clerk_profile(claims["sub"])
    return OnboardingOut(linked=False, email=email, name=name)


@router.post("/onboarding")
async def onboarding(body: OnboardingIn, claims: Claims, s: DB) -> OnboardingOut:
    email, name = await clerk_profile(claims["sub"])
    user, _ = await onboard(s, claims["sub"], email, name, body.company, body.industry)
    return OnboardingOut(linked=True, email=user.email, name=user.name, org=user.org.slug)
