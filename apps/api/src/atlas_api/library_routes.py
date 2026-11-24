"""The Library page (UI Phase 4): one page of the documents a person may read, with server-side
search, filters and sort, plus the numbers the page needs (total, status counts, departments).

Every query starts from access.readable(user), so no filter or combination of filters can
reach a document outside the person's departments. GET /documents (the plain list) stays as
it was for Home, the MCP server and older callers."""

from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import ColumnElement, func, or_, select

from atlas_api import access
from atlas_api.models import EVERYONE, Department, Document, Role, Status, User
from atlas_api.routes import DB, CurrentUser, DocumentOut
from atlas_api.team_routes import review_reason

router = APIRouter()

PerPage = Annotated[int, Query(ge=1, le=100)]
PageNo = Annotated[int, Query(ge=1, le=10_000)]
SearchText = Annotated[str, Query(max_length=200)]
StatusFilter = Literal["ready", "processing", "failed", "review"]
FormatFilter = Literal["pdf", "docx", "md", "txt"]
Sort = Literal["updated", "title"]


class LibraryDoc(DocumentOut):
    # Why it needs review (review date passed, effective > 12 months); only for documents this
    # person may manage (admin: all, manager: own departments), like GET /documents/review.
    review: str | None = None
    can_manage: bool = False  # may replace or delete it


class StatusCounts(BaseModel):
    ready: int = 0
    processing: int = 0  # queued + processing
    failed: int = 0


class LibraryOut(BaseModel):
    items: list[LibraryDoc]
    total: int  # matching the filters
    page: int
    per_page: int
    all: int  # every document this person may read (0 = empty library: show the upload prompt)
    counts: StatusCounts  # over all readable documents, not the filters
    departments: list[str]  # what the department filter offers: Everyone first


def like(q: str) -> str:
    """Search text as an ILIKE pattern: % and _ match themselves (escape char \\)."""
    return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def library_filter(
    user: User,
    q: str = "",
    dept: str = "",
    fmt: str | None = None,
    status: str | None = None,
    public: bool | None = None,
) -> list[ColumnElement[bool]]:
    """WHERE parts for the list. The first one is always the access rule."""
    where: list[ColumnElement[bool]] = [access.readable(user)]
    if q.strip():
        pattern = like(q.strip())
        where.append(
            or_(
                Document.title.ilike(pattern, escape="\\"),
                Document.doc_no.ilike(pattern, escape="\\"),
            )
        )
    if dept:
        where.append(Document.access == dept)
    if fmt:
        where.append(Document.format == fmt)
    if status == "processing":
        where.append(Document.status.in_([Status.queued, Status.processing]))
    elif status in ("ready", "failed"):
        where.append(Document.status == Status(status))
    if public is not None:
        where.append(Document.is_public.is_(public))
    return where


def reason(user: User, d: Document, today: date) -> str | None:
    if not access.can_manage(user, d.access):
        return None
    return review_reason((d.meta or {}).get("review"), d.effective, today)


def item(user: User, d: Document, today: date) -> LibraryDoc:
    out = LibraryDoc.model_validate(d)
    out.review = reason(user, d, today)
    out.can_manage = access.can_manage(user, d.access)
    return out


@router.get("/documents/library")
async def library(
    user: CurrentUser,
    s: DB,
    q: SearchText = "",
    dept: Annotated[str, Query(max_length=100)] = "",
    format: FormatFilter | None = None,
    status: StatusFilter | None = None,
    public: bool | None = None,
    sort: Sort = "updated",
    page: PageNo = 1,
    per_page: PerPage = 20,
) -> LibraryOut:
    where = library_filter(user, q, dept, format, status, public)
    order: list[Any] = (
        [func.lower(Document.title), Document.id]
        if sort == "title"
        else [Document.updated_at.desc(), Document.id.desc()]
    )
    today = date.today()
    if status == "review":
        # Review dates live in free-text front matter ('31 March 2027'), parsed in Python
        # (team_routes.parse_day); a company's library is small enough to check in full.
        rows = await s.scalars(select(Document).where(*where).order_by(*order))
        due = [d for d in rows if reason(user, d, today)]
        total = len(due)
        docs = due[(page - 1) * per_page : page * per_page]
    else:
        total = await s.scalar(select(func.count(Document.id)).where(*where)) or 0
        docs = list(
            await s.scalars(
                select(Document)
                .where(*where)
                .order_by(*order)
                .offset((page - 1) * per_page)
                .limit(per_page)
            )
        )

    counts = StatusCounts()
    for st, n in await s.execute(
        select(Document.status, func.count(Document.id))
        .where(access.readable(user))
        .group_by(Document.status)
    ):
        key = "processing" if st in (Status.queued, Status.processing) else str(st)
        setattr(counts, key, getattr(counts, key) + n)

    if user.role == Role.admin:
        names = list(
            await s.scalars(
                select(Department.name)
                .where(Department.org_id == user.org_id)
                .order_by(Department.name)
            )
        )
    else:
        names = sorted(user.department_names)
    return LibraryOut(
        items=[item(user, d, today) for d in docs],
        total=total,
        page=page,
        per_page=per_page,
        all=counts.ready + counts.processing + counts.failed,
        counts=counts,
        departments=[EVERYONE, *[n for n in names if n != EVERYONE]],
    )
