"""Plans and limits (Phase 10, PLAN.md §8).

demo        the 3 demo companies: open to everyone, so limits are per visitor (IP) per day,
            plus caps on uploads/people so the nightly reset has little to undo
pro         ₹1,499/month: 5,000 questions/month, 200 documents, 25 people, website chat
enterprise  no limits ("Let's talk")
Free has no company of its own (demo only), so there is no `free` plan row.
Question counts live in Redis (one key per company per month); documents and people are
counted in Postgres when someone adds one.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from atlas_api.db import redis
from atlas_api.models import Document, Organization, User


@dataclass(frozen=True)
class Limits:
    questions_month: int | None  # whole company, staff + website + agents
    documents: int | None
    people: int | None
    questions_day_per_visitor: int | None = None  # demo only: per IP


PLANS: dict[str, Limits] = {
    "demo": Limits(questions_month=None, documents=230, people=40, questions_day_per_visitor=40),
    "pro": Limits(questions_month=5000, documents=200, people=25),
    "enterprise": Limits(questions_month=None, documents=None, people=None),
}


def limits(org: Organization) -> Limits:
    return PLANS.get(org.plan, PLANS["pro"])


def month_key(org_id: int) -> str:
    return f"plan:q:{org_id}:{datetime.now(UTC):%Y%m}"


async def questions_used(org_id: int) -> int:
    return int(await redis.get(month_key(org_id)) or 0)


async def count_question(org: Organization, ip: str | None = None) -> None:
    """Count one question; 429 with a plain reason when the plan's limit is reached.
    `ip` is the asker's IP for demo companies (per-visitor daily cap)."""
    lim = limits(org)
    if lim.questions_day_per_visitor and ip:
        key = f"plan:demo:{org.id}:{ip}:{datetime.now(UTC):%Y%m%d}"
        n = int(await redis.incr(key))
        if n == 1:
            await redis.expire(key, 26 * 3600)
        if n > lim.questions_day_per_visitor:
            raise HTTPException(
                429,
                f"The demo allows {lim.questions_day_per_visitor} questions a day per visitor. "
                "Come back tomorrow, or join the Pro waitlist on the home page.",
            )
    key = month_key(org.id)
    n = int(await redis.incr(key))
    if n == 1:
        await redis.expire(key, 32 * 24 * 3600)
    if lim.questions_month is not None and n > lim.questions_month:
        raise HTTPException(
            429,
            f"{org.name} has used its {lim.questions_month:,} questions for this month. "
            "The count starts again on the 1st.",
        )


async def check_documents(s: AsyncSession, org: Organization) -> None:
    cap = limits(org).documents
    if cap is None:
        return
    n = await s.scalar(select(func.count()).select_from(Document).where(Document.org_id == org.id))
    if (n or 0) >= cap:
        raise HTTPException(403, f"Your plan holds {cap} documents. Delete one to add another.")


async def check_people(s: AsyncSession, org: Organization) -> None:
    cap = limits(org).people
    if cap is None:
        return
    n = await s.scalar(select(func.count()).select_from(User).where(User.org_id == org.id))
    if (n or 0) >= cap:
        raise HTTPException(403, f"Your plan has room for {cap} people. Remove someone first.")
