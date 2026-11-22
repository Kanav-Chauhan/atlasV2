"""GET /insights: plain numbers from stored chat messages and document requests."""

import math
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from atlas_api import access
from atlas_api.models import (
    Chat,
    Department,
    DocumentRequest,
    Message,
    Role,
    User,
    user_departments,
)
from atlas_api.routes import DB
from atlas_api.team_routes import Lead

router = APIRouter()
TOP = 10


@dataclass
class Turn:
    """One answered turn: the assistant message plus the question that led to it."""

    question: str
    route: str
    abstained: bool
    latency_ms: int | None
    feedback: str | None
    sources: list[dict[str, Any]]
    created_at: datetime
    departments: set[str] = field(default_factory=set)  # the asker's


def aggregate(
    turns: list[Turn],
    requests: list[dict[str, Any]],
    days: int,
    today: date,
    departments: set[str] | None = None,
) -> dict[str, Any]:
    """`departments`: limit by_department to these (manager); None = all (admin)."""
    rag = [t for t in turns if t.route == "rag"]
    answered = [t for t in rag if not t.abstained]
    not_found = [t for t in rag if t.abstained]
    latencies = sorted(t.latency_ms for t in rag if t.latency_ms is not None)
    unanswered = Counter(t.question.strip() for t in not_found if t.question.strip())
    cited: Counter[int] = Counter()
    titles: dict[int, str] = {}
    for t in answered:
        for src in t.sources:
            if "document_id" in src:
                cited[int(src["document_id"])] += 1
                titles[int(src["document_id"])] = str(src.get("title", ""))
    by_dept = Counter(d for t in turns for d in t.departments)
    per_day = {today - timedelta(days=i): [0, 0] for i in range(days - 1, -1, -1)}
    for t in turns:
        day = per_day.get(t.created_at.astimezone(UTC).date())
        if day is not None:
            day[0] += 1
            day[1] += t.route == "rag" and t.abstained
    return {
        "questions": len(turns),
        "answered": len(answered),
        "not_found": len(not_found),
        "blocked": sum(t.route == "blocked" for t in turns),
        "smalltalk": sum(t.route in ("smalltalk", "offtopic") for t in turns),
        "answered_pct": round(100 * len(answered) / len(rag), 1) if rag else None,
        "avg_latency_ms": round(sum(latencies) / len(latencies)) if latencies else None,
        "p95_latency_ms": latencies[math.ceil(0.95 * len(latencies)) - 1] if latencies else None,
        "feedback": {
            "up": sum(t.feedback == "up" for t in turns),
            "down": sum(t.feedback == "down" for t in turns),
        },
        "top_unanswered": [{"question": q, "count": n} for q, n in unanswered.most_common(TOP)],
        "document_requests": requests,
        "top_documents": [
            {"document_id": d, "title": titles[d], "citations": n}
            for d, n in cited.most_common(TOP)
        ],
        "by_department": [
            {"department": d, "questions": n}
            for d, n in sorted(by_dept.items(), key=lambda x: (-x[1], x[0]))
            if departments is None or d in departments
        ],
        "per_day": [
            {"date": d.isoformat(), "questions": q, "not_found": nf}
            for d, (q, nf) in per_day.items()
        ],
    }


async def people_departments(s: AsyncSession, org_id: int) -> dict[int, set[str]]:
    rows = await s.execute(
        select(user_departments.c.user_id, Department.name)
        .join(Department, Department.id == user_departments.c.department_id)
        .where(Department.org_id == org_id)
    )
    out: dict[int, set[str]] = {}
    for uid, name in rows:
        out.setdefault(uid, set()).add(name)
    return out


async def insights_for(s: AsyncSession, actor: User, days: int) -> dict[str, Any]:
    """Admin: the whole org. Manager: questions and requests from people in own departments."""
    since = datetime.now(UTC) - timedelta(days=days)
    depts = await people_departments(s, actor.org_id)

    def in_scope(user_id: int) -> bool:
        return access.sees_person(actor, depts.get(user_id, set()))

    # shortcut: aggregates in Python over the window; move to SQL GROUP BYs past ~100k messages.
    rows = await s.execute(
        select(Message, Chat.user_id)
        .join(Chat, Chat.id == Message.chat_id)
        .where(Chat.org_id == actor.org_id, Message.created_at >= since)
        .order_by(Message.chat_id, Message.created_at, Message.id)
    )
    turns, last_question = [], ""
    for m, uid in rows:
        if m.role == "user":
            last_question = m.text
        elif in_scope(uid):
            turns.append(
                Turn(
                    question=last_question,
                    route=m.route or "rag",
                    abstained=m.abstained,
                    latency_ms=m.latency_ms,
                    feedback=m.feedback,
                    sources=m.sources or [],
                    created_at=m.created_at,
                    departments=depts.get(uid, set()),
                )
            )
    reqs = await s.execute(
        select(DocumentRequest, User.name)
        .join(User, User.id == DocumentRequest.user_id)
        .where(DocumentRequest.org_id == actor.org_id, DocumentRequest.created_at >= since)
        .order_by(DocumentRequest.created_at.desc())
    )
    requests = [
        {"question": r.question, "note": r.note, "by": name, "created_at": r.created_at}
        for r, name in reqs
        if in_scope(r.user_id)
    ][:50]
    scope = None if actor.role == Role.admin else access.team_scope(actor)
    return aggregate(turns, requests, days, datetime.now(UTC).date(), scope)


@router.get("/insights")
async def insights(user: Lead, s: DB, days: Annotated[int, Query(ge=1, le=365)] = 30) -> Any:
    return await insights_for(s, user, days)
