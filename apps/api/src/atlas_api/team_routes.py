"""Phase 7 dashboard: team, departments (= access groups), documents to review, org
(docs/API.md "Endpoints (Phase 7: dashboard)"). UI phase 5 adds the paged people directory,
group cards, bulk changes, CSV import and email-domain auto-join. Rules live in access.py."""

import asyncio
import csv
import io
import logging
import re
from datetime import date, datetime, timedelta
from typing import Annotated, Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import ColumnElement, and_, func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from atlas_api import access, cache, clerk, plans
from atlas_api.db import CHUNKS_TABLE
from atlas_api.models import (
    EVERYONE,
    Department,
    Document,
    Organization,
    Role,
    User,
    user_departments,
)
from atlas_api.routes import DB, CurrentUser
from atlas_api.settings import settings

log = logging.getLogger(__name__)
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
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
Email = Annotated[
    str, StringConstraints(strip_whitespace=True, to_lower=True, pattern=EMAIL_PATTERN)
]
Desc = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]

# ------------------------------------------------------------------ team


PersonStatus = Literal["active", "invited", "expired"]


def status_of(u: User, today: date | None = None) -> PersonStatus:
    """expired = a guest past their end date; invited = never signed in yet; else active."""
    if u.role == Role.guest and u.guest_until and u.guest_until < (today or date.today()):
        return "expired"
    return "invited" if u.last_active is None else "active"


class Person(BaseModel):
    id: int
    name: str
    email: str
    title: str
    role: Role
    departments: list[str]
    guest_until: date | None
    last_active: datetime | None
    status: PersonStatus = "active"
    avatar_url: str | None = None  # UI phase 8 (profile_routes): None = show initials


class AddedPerson(Person):
    # Clerk invitation email (real companies only): "sent", "exists" (already has a Clerk
    # login: they just sign in), "failed" (person added, invitation not sent), None (demo).
    invite: str | None = None


class PersonIn(BaseModel):
    name: Name | None = None  # default: from the email ("neha.gupta@" → "Neha Gupta")
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
        status=status_of(u),
        avatar_url=f"/api/people/{u.id}/avatar?v={u.avatar}" if u.avatar else None,
    )


def name_from_email(email: str) -> str:
    local = email.split("@")[0].split("+")[0]
    words = [w for w in local.replace("_", ".").replace("-", ".").split(".") if w]
    return " ".join(w.capitalize() for w in words)[:200] or email


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


async def send_invite(org: Organization, email: str) -> str | None:
    if org.plan == "demo" or not settings.clerk_secret_key:
        return None
    try:
        return await clerk.invite(email)
    except httpx.HTTPError as e:
        log.warning("clerk invitation failed: %s", type(e).__name__)
        return "failed"


@router.post("/team", status_code=201)
async def add_person(body: PersonIn, user: Lead, s: DB) -> AddedPerson:
    if not access.can_manage_person(user, body.role, set(body.departments)):
        raise HTTPException(403, "You can only add members and guests to your own departments.")
    email = body.email
    if await s.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(409, "Someone with this email already exists.")
    await plans.check_people(s, user.org)
    u = User(
        org_id=user.org_id,
        name=body.name or name_from_email(email),
        email=email,
        title=body.title,
        role=body.role,
        guest_until=body.guest_until,
        departments=await org_departments(s, user.org_id, body.departments),
    )
    s.add(u)
    await s.commit()
    invite = await send_invite(user.org, email)
    return AddedPerson(**person(u).model_dump(), invite=invite)


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
    await cache.invalidate(user.org_id)  # documents' access labels changed
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


# ------------------------------------------------------------------ directory (UI phase 5)

PER_PAGE_MAX = 100


class PeoplePage(BaseModel):
    people: list[Person]
    total: int
    page: int
    per_page: int


def like(q: str) -> str:
    return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def directory_filter(
    actor: User,
    q: str = "",
    role: Role | None = None,
    dept: str = "",
    status: PersonStatus | None = None,
    today: date | None = None,
) -> ColumnElement[bool]:
    """Who the directory lists: always inside the actor's scope (access.people_visible), then
    search (name, email, title), role, group and status. dept "Everyone" = everybody;
    "-" = people in no group (they read Everyone documents only)."""
    today = today or date.today()
    where: list[ColumnElement[bool]] = [access.people_visible(actor)]
    if q.strip():
        pat = like(q.strip())
        where.append(
            or_(
                User.name.ilike(pat, escape="\\"),
                User.email.ilike(pat, escape="\\"),
                User.title.ilike(pat, escape="\\"),
            )
        )
    if role is not None:
        where.append(User.role == role)
    if dept == "-":
        where.append(~User.departments.any())
    elif dept and dept != EVERYONE:
        where.append(
            User.departments.any(and_(Department.org_id == actor.org_id, Department.name == dept))
        )
    expired = and_(User.role == Role.guest, User.guest_until < today)
    if status == "expired":
        where.append(expired)
    elif status == "invited":
        where.append(and_(User.last_active.is_(None), ~expired))
    elif status == "active":
        where.append(and_(User.last_active.is_not(None), ~expired))
    return and_(*where)


@router.get("/team/people")
async def people_page(
    user: Lead,
    s: DB,
    q: Annotated[str, Field(max_length=200)] = "",
    role: Role | None = None,
    dept: Annotated[str, Field(max_length=100)] = "",
    status: PersonStatus | None = None,
    page: Annotated[int, Field(ge=1, le=100_000)] = 1,
    per_page: Annotated[int, Field(ge=1, le=PER_PAGE_MAX)] = 25,
) -> PeoplePage:
    """One page of the people directory, filtered on the server (never the whole company)."""
    where = directory_filter(user, q, role, dept, status)
    total = await s.scalar(select(func.count()).select_from(User).where(where)) or 0
    rows = await s.scalars(
        select(User)
        .where(where)
        .order_by(func.lower(User.name), User.id)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    return PeoplePage(people=[person(u) for u in rows], total=total, page=page, per_page=per_page)


# ------------------------------------------------------------------ groups (UI phase 5)
# A group IS a department: its people read its documents (documents.access = the department
# name) plus Everyone documents. One group = one department of documents (docs/DECISIONS.md).


class GroupOut(BaseModel):
    name: str
    description: str
    people: int
    documents: int
    reads: list[str]
    managers: list[str]
    managers_more: int = 0


class EveryoneOut(BaseModel):
    people: int
    documents: int


class GroupsOut(BaseModel):
    total: int
    roles: dict[str, int]
    everyone: EveryoneOut
    groups: list[GroupOut]
    no_group: int  # people in no group: they read Everyone documents only


SHOW_MANAGERS = 4


@router.get("/team/groups")
async def groups(user: Lead, s: DB) -> GroupsOut:
    """Group cards + role summary, counted in SQL (fine for thousands of people)."""
    visible = access.people_visible(user)
    roles = dict.fromkeys((r.value for r in Role), 0)
    for r, n in await s.execute(select(User.role, func.count()).where(visible).group_by(User.role)):
        roles[Role(r).value] = n
    no_group = await s.scalar(
        select(func.count()).select_from(User).where(visible, ~User.departments.any())
    )
    depts = list(
        await s.scalars(
            select(Department).where(Department.org_id == user.org_id).order_by(Department.name)
        )
    )
    if user.role == Role.manager:
        depts = [d for d in depts if d.name in access.team_scope(user)]
    ids = [d.id for d in depts]
    people: dict[int, int] = {}
    managers: dict[int, list[str]] = {}
    if ids:
        link = user_departments.c
        for dept_id, n in await s.execute(
            select(link.department_id, func.count())
            .where(link.department_id.in_(ids))
            .group_by(link.department_id)
        ):
            people[dept_id] = n
        for dept_id, name in await s.execute(
            select(link.department_id, User.name)
            .join(User, User.id == link.user_id)
            .where(link.department_id.in_(ids), User.role == Role.manager)
            .order_by(User.name)
        ):
            managers.setdefault(dept_id, []).append(name)
    docs: dict[str, int] = {}
    for acc, n in await s.execute(
        select(Document.access, func.count())
        .where(Document.org_id == user.org_id)
        .group_by(Document.access)
    ):
        docs[acc] = n
    return GroupsOut(
        total=sum(roles.values()),
        roles=roles,
        everyone=EveryoneOut(people=sum(roles.values()), documents=docs.get(EVERYONE, 0)),
        no_group=no_group or 0,
        groups=[
            GroupOut(
                name=d.name,
                description=d.description,
                people=people.get(d.id, 0),
                documents=docs.get(d.name, 0),
                reads=[d.name, EVERYONE],
                managers=managers.get(d.id, [])[:SHOW_MANAGERS],
                managers_more=max(0, len(managers.get(d.id, [])) - SHOW_MANAGERS),
            )
            for d in depts
        ],
    )


# ------------------------------------------------------------------ bulk changes (UI phase 5)

BULK_MAX = 500


class BulkIn(BaseModel):
    ids: Annotated[list[int], Field(min_length=1, max_length=BULK_MAX)]
    role: Role | None = None
    add_group: Name | None = None
    remove_group: Name | None = None


class BulkError(BaseModel):
    id: int
    name: str
    error: str


class BulkOut(BaseModel):
    changed: int
    errors: list[BulkError]


SCOPE_ERROR = "You can only manage members and guests of your own groups."


def bulk_change(
    actor: User, people: list[User], body: BulkIn, groups: dict[str, Department], admins: int
) -> tuple[list[tuple[User, Role, list[Department]]], list[BulkError]]:
    """Plan a bulk change person by person with the same rules as PATCH /team/{id}
    (access.can_manage_person before and after, access.role_change_error with a running
    admin count so a bulk demotion can never remove the last admin)."""
    plan: list[tuple[User, Role, list[Department]]] = []
    errors: list[BulkError] = []
    for u in people:
        role = body.role or u.role
        new = list(u.departments)
        if body.add_group and body.add_group not in u.department_names:
            new.append(groups[body.add_group])
        if body.remove_group:
            new = [d for d in new if d.name != body.remove_group]
        names = {d.name for d in new}
        error = None
        if not access.can_manage_person(
            actor, u.role, u.department_names
        ) or not access.can_manage_person(actor, role, names):
            error = SCOPE_ERROR
        else:
            error = access.role_change_error(actor, u, role, admins)
        if error:
            errors.append(BulkError(id=u.id, name=u.name, error=error))
            continue
        if u.role == Role.admin and role != Role.admin:
            admins -= 1
        elif u.role != Role.admin and role == Role.admin:
            admins += 1
        plan.append((u, role, new))
    return plan, errors


@router.post("/team/bulk")
async def bulk(body: BulkIn, user: Lead, s: DB) -> BulkOut:
    """One change (role, add to a group or remove from a group) for many selected people.
    People the actor may not change are skipped and listed in `errors`."""
    if sum(x is not None for x in (body.role, body.add_group, body.remove_group)) != 1:
        raise HTTPException(400, "Choose one change: a role, a group to add or a group to remove.")
    names = [n for n in (body.add_group, body.remove_group) if n]
    groups = {d.name: d for d in await org_departments(s, user.org_id, names)}
    ids = sorted(set(body.ids))
    found = list(
        await s.scalars(
            select(User).where(User.id.in_(ids), access.people_visible(user)).order_by(User.name)
        )
    )
    missing = set(ids) - {u.id for u in found}
    plan, errors = bulk_change(user, found, body, groups, await admin_count(s, user.org_id))
    errors += [BulkError(id=i, name="", error="Person not found.") for i in sorted(missing)]
    for u, role, depts in plan:
        u.role = role
        u.departments = depts
    await s.commit()
    return BulkOut(changed=len(plan), errors=errors)


# ------------------------------------------------------------------ CSV import (UI phase 5)

IMPORT_MAX_ROWS = 500
IMPORT_MAX_CHARS = 300_000
INVITES_AT_ONCE = 5


class ImportRowIn(BaseModel):
    email: str = ""
    name: str = ""
    title: str = ""
    role: str = ""
    groups: str = ""  # "Engineering; Product" (`;` or `|` between groups)


class ImportIn(BaseModel):
    csv: Annotated[str, Field(max_length=IMPORT_MAX_CHARS)] | None = None
    rows: Annotated[list[ImportRowIn], Field(max_length=IMPORT_MAX_ROWS)] | None = None
    dry_run: bool = True


class ImportRow(BaseModel):
    line: int
    email: str
    name: str
    title: str
    role: str
    groups: list[str]
    error: str | None = None
    invite: str | None = None


class ImportOut(BaseModel):
    dry_run: bool
    rows: list[ImportRow]
    valid: int
    invalid: int
    created: int


def parse_csv(raw: str) -> list[tuple[int, ImportRowIn]]:
    """(line number, row) from CSV text with a header row: email,name,title,role,groups.
    Headers are case-insensitive; only email is required."""
    reader = csv.DictReader(io.StringIO(raw.lstrip("\ufeff").strip()))
    if not reader.fieldnames:
        raise HTTPException(400, "The file is empty.")
    headers = {h: (h or "").strip().lower() for h in reader.fieldnames}
    if "email" not in headers.values():
        raise HTTPException(
            400, "The first line must name the columns: email,name,title,role,groups."
        )
    out = []
    for rec in reader:
        values = {headers[k]: (v or "").strip() for k, v in rec.items() if k in headers}
        if not any(values.values()):
            continue
        out.append(
            (
                reader.line_num,
                ImportRowIn(**{k: values.get(k, "") for k in ImportRowIn.model_fields}),
            )
        )
        if len(out) > IMPORT_MAX_ROWS:
            raise HTTPException(400, f"Up to {IMPORT_MAX_ROWS} people per file. Split the file.")
    return out


def check_rows(
    actor: User, rows: list[tuple[int, ImportRowIn]], groups: list[str], taken: set[str]
) -> list[ImportRow]:
    """Validate every row (nothing is written): email, duplicates in the file, already in
    Atlas, role, groups that exist, and the actor's scope (managers: members/guests of their
    own groups only)."""
    canon = {g.lower(): g for g in groups}
    seen: set[str] = set()
    out = []
    for line, r in rows:
        email = r.email.strip().lower()
        role = (r.role.strip() or "member").lower()
        wanted = [g.strip() for g in r.groups.replace("|", ";").split(";") if g.strip()]
        names = [canon.get(g.lower(), g) for g in wanted if g.lower() != EVERYONE.lower()]
        row = ImportRow(
            line=line,
            email=email,
            name=(r.name.strip() or name_from_email(email))[:200],
            title=r.title.strip()[:200],
            role=role,
            groups=sorted(set(names)),
        )
        unknown = [g for g in names if g.lower() not in canon]
        if not re.match(EMAIL_PATTERN, email):
            row.error = "Not an email address."
        elif email in seen:
            row.error = "This email is in the file twice."
        elif email in taken:
            row.error = "Already in Atlas."
        elif role not in {x.value for x in Role}:
            row.error = "Role must be admin, manager, member or guest."
        elif unknown:
            row.error = f"There is no group called {unknown[0]}."
        elif not access.can_manage_person(actor, Role(role), set(row.groups)):
            row.error = "You can only add members and guests to your own groups."
        seen.add(email)
        out.append(row)
    return out


async def send_invites(org: Organization, rows: list[ImportRow]) -> None:
    gate = asyncio.Semaphore(INVITES_AT_ONCE)

    async def one(row: ImportRow) -> None:
        async with gate:
            row.invite = await send_invite(org, row.email)

    await asyncio.gather(*(one(r) for r in rows))


@router.post("/team/import")
async def import_people(body: ImportIn, user: Lead, s: DB) -> ImportOut:
    """Add many people at once from CSV text (or rows). dry_run=true (default) only checks;
    dry_run=false adds the valid rows, skips the rest, and sends invitations."""
    if body.csv is not None:
        rows = parse_csv(body.csv)
    elif body.rows is not None:
        rows = [(i + 1, r) for i, r in enumerate(body.rows)]
    else:
        raise HTTPException(400, "Send csv or rows.")
    if not rows:
        raise HTTPException(400, "No people found in the file.")
    groups = list(await s.scalars(select(Department.name).where(Department.org_id == user.org_id)))
    emails = [r.email.strip().lower() for _, r in rows]
    taken = set(
        await s.scalars(select(func.lower(User.email)).where(func.lower(User.email).in_(emails)))
    )
    checked = check_rows(user, rows, groups, taken)
    good = [r for r in checked if r.error is None]
    created: list[ImportRow] = []
    if not body.dry_run and good:
        depts = {d.name: d for d in await org_departments(s, user.org_id, groups)}
        for r in good:
            try:
                await plans.check_people(s, user.org)
            except HTTPException as e:
                r.error = str(e.detail)
                continue
            s.add(
                User(
                    org_id=user.org_id,
                    name=r.name,
                    email=r.email,
                    title=r.title,
                    role=Role(r.role),
                    departments=[depts[g] for g in r.groups],
                )
            )
            await s.flush()
            created.append(r)
        await s.commit()
        await send_invites(user.org, created)
    invalid = sum(r.error is not None for r in checked)
    return ImportOut(
        dry_run=body.dry_run,
        rows=checked,
        valid=len(checked) - invalid,
        invalid=invalid,
        created=len(created),
    )


# ------------------------------------------------------------------ auto-join (UI phase 5)


class AutoJoinOut(BaseModel):
    domains: list[str]
    role: Role
    departments: list[str]
    available: bool  # false for demo companies
    allowed_domains: list[str]  # domains of this company's admins (the only ones it may claim)


class AutoJoinPatch(BaseModel):
    domains: Annotated[list[str], Field(max_length=20)] | None = None
    role: Role | None = None
    departments: list[str] | None = None


async def admin_domains(s: AsyncSession, org_id: int) -> list[str]:
    emails = await s.scalars(
        select(User.email).where(User.org_id == org_id, User.role == Role.admin)
    )
    return sorted(
        {clerk.email_domain(e) for e in emails if not clerk.domain_error(clerk.email_domain(e))}
    )


async def auto_join_out(s: AsyncSession, org: Organization) -> AutoJoinOut:
    conf = clerk.auto_join_config(org)
    return AutoJoinOut(
        domains=conf["domains"],
        role=Role(conf["role"]),
        departments=conf["departments"],
        available=org.plan != "demo",
        allowed_domains=await admin_domains(s, org.id),
    )


@router.get("/org/auto-join")
async def get_auto_join(user: Admin, s: DB) -> AutoJoinOut:
    return await auto_join_out(s, user.org)


@router.patch("/org/auto-join")
async def change_auto_join(body: AutoJoinPatch, user: Admin, s: DB) -> AutoJoinOut:
    """Email-domain auto-join: a verified sign-in at one of `domains` with no Atlas person joins
    this company with `role` (member or guest) in `departments`. Rules: not for demo
    companies; no public email services; only domains of this company's own admins; a domain
    belongs to one company."""
    org = await s.get(Organization, user.org_id)
    if org is None or org.plan == "demo":
        raise HTTPException(403, "Demo companies can't use auto-join.")
    conf = clerk.auto_join_config(org)
    if body.domains is not None:
        domains = sorted({d.strip().lower().lstrip("@") for d in body.domains if d.strip()})
        allowed = set(await admin_domains(s, org.id))
        for d in domains:
            error = clerk.domain_error(d)
            if error:
                raise HTTPException(400, error)
            if d not in allowed:
                raise HTTPException(
                    403, f"Only a domain an admin here signs in with can auto-join (not {d})."
                )
            other = await s.scalar(
                select(Organization.id).where(
                    Organization.id != org.id, Organization.auto_join["domains"].contains([d])
                )
            )
            if other:
                raise HTTPException(409, f"Another company already auto-joins {d}.")
        conf["domains"] = domains
    if body.role is not None:
        if body.role not in clerk.AUTO_JOIN_ROLES:
            raise HTTPException(400, "New people can join as a member or a guest only.")
        conf["role"] = body.role.value
    if body.departments is not None:
        names = sorted({n for n in body.departments if n != EVERYONE})
        if access.MANAGERS in names:
            raise HTTPException(400, "The Managers group can't be given automatically.")
        conf["departments"] = [d.name for d in await org_departments(s, org.id, names)]
    org.auto_join = conf
    await s.commit()
    return await auto_join_out(s, org)


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


# ------------------------------------------------------------------ plan (Phase 10)


class PlanOut(BaseModel):
    plan: str
    questions_month: int | None
    questions_used: int
    documents: int | None
    documents_used: int
    people: int | None
    people_used: int


@router.get("/org/plan")
async def org_plan(user: Admin, s: DB) -> PlanOut:
    lim = plans.limits(user.org)
    docs = await s.scalar(
        select(func.count()).select_from(Document).where(Document.org_id == user.org_id)
    )
    people = await s.scalar(
        select(func.count()).select_from(User).where(User.org_id == user.org_id)
    )
    return PlanOut(
        plan=user.org.plan,
        questions_month=lim.questions_month,
        questions_used=await plans.questions_used(user.org_id),
        documents=lim.documents,
        documents_used=docs or 0,
        people=lim.people,
        people_used=people or 0,
    )
