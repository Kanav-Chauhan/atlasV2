"""Phase 7 dashboard: team, departments, who-sees-what, documents to review, org
(docs/API.md "Endpoints (Phase 7: dashboard)"). Rules live in access.py."""

from datetime import date, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, StringConstraints
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from atlas_api import access
from atlas_api.db import CHUNKS_TABLE
from atlas_api.models import EVERYONE, Department, Document, Organization, Role, User
from atlas_api.routes import DB, CurrentUser

router = APIRouter()


def lead(user: CurrentUser) -> User:
    if user.role not in access.LEADS:
        raise HTTPException(403, "Only an admin or a manager can open this.")
    return user


def admin(user: CurrentUser) -> User:
    if user.role != Role.admin:
        raise HTTPException(403, "Only an admin can do this.")
    return user


Lead = Annotated[User, Depends(lead)]
Admin = Annotated[User, Depends(admin)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Email = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
]
Desc = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]

# ------------------------------------------------------------------ team


class Person(BaseModel):
    id: int
    name: str
    email: str
    title: str
    role: Role
    departments: list[str]
    guest_until: date | None
    last_active: datetime | None


class PersonIn(BaseModel):
    name: Name
    email: Email
    title: Desc = ""
    role: Role
    departments: list[str]
    guest_until: date | None = None


class PersonPatch(BaseModel):
    title: Desc | None = None
    role: Role | None = None
    departments: list[str] | None = None
    guest_until: date | None = None


def person(u: User) -> Person:
    return Person(
        id=u.id,
        name=u.name,
        email=u.email,
        title=u.title,
        role=u.role,
        departments=sorted(u.department_names),
        guest_until=u.guest_until,
        last_active=u.last_active,
    )


async def org_people(s: AsyncSession, actor: User) -> list[User]:
    """Everyone in the actor's org the actor may see (manager: people in own departments)."""
    users = await s.scalars(select(User).where(User.org_id == actor.org_id).order_by(User.name))
    return [u for u in users if access.sees_person(actor, u.department_names)]


async def org_departments(s: AsyncSession, org_id: int, names: list[str]) -> list[Department]:
    found = list(
        await s.scalars(
            select(Department).where(Department.org_id == org_id, Department.name.in_(names))
        )
    )
    missing = set(names) - {d.name for d in found}
    if missing:
        raise HTTPException(400, f"There is no department called {sorted(missing)[0]}.")
    return found


async def admin_count(s: AsyncSession, org_id: int) -> int:
    n = await s.scalar(select(func.count()).where(User.org_id == org_id, User.role == Role.admin))
    return n or 0


async def managed_person(s: AsyncSession, actor: User, person_id: int) -> User:
    u = await s.get(User, person_id)
    if u is None or u.org_id != actor.org_id or not access.sees_person(actor, u.department_names):
        raise HTTPException(404, "Person not found.")
    if not access.can_manage_person(actor, u.role, u.department_names):
        raise HTTPException(403, "You can only manage members and guests of your own departments.")
    return u


@router.get("/team")
async def team(user: Lead, s: DB) -> list[Person]:
    return [person(u) for u in await org_people(s, user)]


@router.post("/team", status_code=201)
async def add_person(body: PersonIn, user: Lead, s: DB) -> Person:
    if not access.can_manage_person(user, body.role, set(body.departments)):
        raise HTTPException(403, "You can only add members and guests to your own departments.")
    email = body.email
    if await s.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(409, "Someone with this email already exists.")
    u = User(
        org_id=user.org_id,
        name=body.name,
        email=email,
        title=body.title,
        role=body.role,
        guest_until=body.guest_until,
        departments=await org_departments(s, user.org_id, body.departments),
    )
    s.add(u)
    await s.commit()
    return person(u)


@router.patch("/team/{person_id}")
async def change_person(person_id: int, body: PersonPatch, user: Lead, s: DB) -> Person:
    u = await managed_person(s, user, person_id)
    role = body.role or u.role
    depts = u.department_names if body.departments is None else set(body.departments)
    if not access.can_manage_person(user, role, depts):
        raise HTTPException(403, "You can only manage members and guests of your own departments.")
    error = access.role_change_error(user, u, role, await admin_count(s, user.org_id))
    if error:
        raise HTTPException(403, error)
    if body.departments is not None:
        u.departments = await org_departments(s, user.org_id, body.departments)
    u.role = role
    fields = body.model_fields_set
    if "title" in fields and body.title is not None:
        u.title = body.title
    if "guest_until" in fields:
        u.guest_until = body.guest_until
    await s.commit()
    return person(u)


@router.delete("/team/{person_id}", status_code=204)
async def remove_person(person_id: int, user: Lead, s: DB) -> Response:
    u = await managed_person(s, user, person_id)
    error = access.delete_error(user, u, await admin_count(s, user.org_id))
    if error:
        raise HTTPException(403, error)
    await s.delete(u)
    await s.commit()
    return Response(status_code=204)


# ------------------------------------------------------------------ departments


class DepartmentIn(BaseModel):
    name: Name
    description: Desc = ""


class DepartmentPatch(BaseModel):
    name: Name | None = None
    description: Desc | None = None


class DepartmentOut(BaseModel):
    name: str
    description: str


async def department(s: AsyncSession, org_id: int, name: str) -> Department:
    d = await s.scalar(
        select(Department).where(Department.org_id == org_id, Department.name == name)
    )
    if d is None:
        raise HTTPException(404, "Department not found.")
    return d


async def name_free(s: AsyncSession, org_id: int, name: str) -> None:
    if name == EVERYONE or await s.scalar(
        select(Department.id).where(Department.org_id == org_id, Department.name == name)
    ):
        raise HTTPException(409, f"A department called {name} already exists.")


@router.post("/departments", status_code=201)
async def add_department(body: DepartmentIn, user: Admin, s: DB) -> DepartmentOut:
    await name_free(s, user.org_id, body.name)
    s.add(Department(org_id=user.org_id, name=body.name, description=body.description))
    await s.commit()
    return DepartmentOut(name=body.name, description=body.description)


@router.patch("/departments/{name}")
async def change_department(name: str, body: DepartmentPatch, user: Admin, s: DB) -> DepartmentOut:
    d = await department(s, user.org_id, name)
    if body.description is not None:
        d.description = body.description
    if body.name is not None and body.name != d.name:
        await name_free(s, user.org_id, body.name)
        # Documents and chunks point at the department by name; rename them in one transaction.
        await s.execute(
            update(Document)
            .where(Document.org_id == user.org_id, Document.access == d.name)
            .values(access=body.name)
        )
        if await s.scalar(text(f"SELECT to_regclass('{CHUNKS_TABLE}')")):
            await s.execute(
                text(
                    f"UPDATE {CHUNKS_TABLE} SET metadata_ = jsonb_set(metadata_, '{{access}}',"
                    " to_jsonb(CAST(:new AS text)))"
                    " WHERE metadata_->>'org_id' = :org AND metadata_->>'access' = :old"
                ),
                {"new": body.name, "old": d.name, "org": str(user.org_id)},
            )
        d.name = body.name
    await s.commit()
    return DepartmentOut(name=d.name, description=d.description)


@router.delete("/departments/{name}", status_code=204)
async def remove_department(name: str, user: Admin, s: DB) -> Response:
    d = await department(s, user.org_id, name)
    if await s.scalar(
        select(Document.id).where(Document.org_id == user.org_id, Document.access == d.name)
    ):
        raise HTTPException(409, "This department still has documents.")
    if await s.scalar(select(User.id).where(User.departments.any(Department.id == d.id))):
        raise HTTPException(409, "This department still has people.")
    await s.delete(d)
    await s.commit()
    return Response(status_code=204)


# ------------------------------------------------------------------ who sees what


class AccessPerson(BaseModel):
    id: int
    name: str
    role: Role
    can_read: dict[str, bool]
    everyone: bool = True


class AccessOut(BaseModel):
    departments: list[str]
    people: list[AccessPerson]


@router.get("/access")
async def who_sees_what(user: Lead, s: DB) -> AccessOut:
    names = list(
        await s.scalars(
            select(Department.name)
            .where(Department.org_id == user.org_id)
            .order_by(Department.name)
        )
    )
    if user.role == Role.manager:
        names = [n for n in names if n in access.team_scope(user)]
    return AccessOut(
        departments=names,
        people=[
            AccessPerson(
                id=u.id,
                name=u.name,
                role=u.role,
                can_read={n: u.role == Role.admin or n in u.department_names for n in names},
            )
            for u in await org_people(s, user)
        ],
    )


# ------------------------------------------------------------------ documents to review


class ReviewOut(BaseModel):
    id: int
    title: str
    access: str
    effective: str | None
    review: str | None
    reason: str


def parse_day(value: Any) -> date | None:
    """Front matter dates look like '31 March 2027'; anything else ('On amendment') is None."""
    for fmt in ("%d %B %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(value), fmt).date()
        except ValueError:
            pass
    return None


def review_reason(review: Any, effective: Any, today: date) -> str | None:
    due = parse_day(review)
    if due and due < today:
        return f"Review date passed ({review})."
    start = parse_day(effective)
    if start and start < today - timedelta(days=365):
        return f"Effective since {effective}, more than 12 months ago."
    return None


@router.get("/documents/review")
async def documents_to_review(user: Lead, s: DB) -> list[ReviewOut]:
    query = select(Document).where(Document.org_id == user.org_id)
    if user.role == Role.manager:
        query = query.where(Document.access.in_(user.department_names))
    today = date.today()
    out = []
    for d in await s.scalars(query.order_by(Document.title)):
        review = (d.meta or {}).get("review")
        reason = review_reason(review, d.effective, today)
        if reason:
            out.append(
                ReviewOut(
                    id=d.id,
                    title=d.title,
                    access=d.access,
                    effective=d.effective,
                    review=review,
                    reason=reason,
                )
            )
    return out


# ------------------------------------------------------------------ org


class OrgOut(BaseModel):
    slug: str
    name: str
    industry: str
    description: str


class OrgPatch(BaseModel):
    name: Name | None = None
    industry: Desc | None = None
    description: Desc | None = None


def org_out(o: Organization) -> OrgOut:
    return OrgOut(slug=o.slug, name=o.name, industry=o.industry, description=o.description)


@router.get("/org")
async def get_org(user: Admin) -> OrgOut:
    return org_out(user.org)


@router.patch("/org")
async def change_org(body: OrgPatch, user: Admin, s: DB) -> OrgOut:
    o = user.org
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(o, field, value)
    await s.commit()
    return org_out(o)


# ------------------------------------------------------------------ demo reset (Phase 10)

RESET_LOCK_SECONDS = 300


@router.post("/demo/reset", status_code=202)
async def reset_demo(user: Admin) -> dict[str, str]:
    """Queue a reset of this demo company (demo_reset.py). Admins of the 3 demo companies only;
    one reset per company per 5 minutes."""
    from atlas_api import website
    from atlas_api.db import redis
    from atlas_api.worker import reset_demo as task

    slug = user.org.slug
    if slug not in website.DEMO_SLUGS:
        raise HTTPException(403, "Only the demo companies can be reset.")
    if not await redis.set(f"demo:reset:{slug}", "1", nx=True, ex=RESET_LOCK_SECONDS):
        raise HTTPException(429, "The demo was reset a moment ago. Try again in a few minutes.")
    task.delay(slug)
    return {"status": "queued"}
