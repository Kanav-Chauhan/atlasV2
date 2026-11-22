from collections.abc import AsyncIterator
from datetime import date, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from atlas_api import access, uploads
from atlas_api.db import CHUNKS_TABLE, Session
from atlas_api.models import EVERYONE, Department, Document, Role, User, user_departments
from atlas_api.settings import settings

router = APIRouter()


async def db() -> AsyncIterator[AsyncSession]:
    async with Session() as s:
        yield s


DB = Annotated[AsyncSession, Depends(db)]


async def current_user(s: DB, atlas_demo_user: Annotated[str | None, Cookie()] = None) -> User:
    user = None
    if atlas_demo_user:
        user = await s.scalar(select(User).where(User.email == atlas_demo_user))
    if user is None:
        raise HTTPException(401, "Please log in.")
    if user.role == Role.guest and user.guest_until and user.guest_until < date.today():
        raise HTTPException(403, "Your guest access has ended.")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


class Org(BaseModel):
    slug: str
    name: str


class Me(BaseModel):
    email: str
    name: str
    title: str
    role: Role
    departments: list[str]
    org: Org


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    doc_no: str | None
    access: str
    is_public: bool
    format: str
    status: str
    error: str | None
    pages: int | None
    chunks: int | None
    version: str | None
    effective: str | None
    superseded_by: str | None
    updated_at: datetime


class DepartmentOut(BaseModel):
    name: str
    description: str
    members: int


@router.get("/me")
async def me(user: CurrentUser) -> Me:
    return Me(
        email=user.email,
        name=user.name,
        title=user.title,
        role=user.role,
        departments=sorted(user.department_names),
        org=Org(slug=user.org.slug, name=user.org.name),
    )


@router.get("/documents")
async def list_documents(
    user: CurrentUser,
    s: DB,
    q: str | None = None,
    access_: Annotated[str | None, Query(alias="access")] = None,
) -> list[DocumentOut]:
    query = select(Document).where(access.readable(user))
    if q:
        query = query.where(Document.title.ilike(f"%{q}%"))
    if access_:
        query = query.where(Document.access == access_)
    docs = await s.scalars(query.order_by(Document.updated_at.desc(), Document.id.desc()))
    return [DocumentOut.model_validate(d) for d in docs]


async def readable_doc(s: AsyncSession, user: User, doc_id: int) -> Document:
    doc = await s.get(Document, doc_id)
    if not doc or not access.can_read(user, doc):
        raise HTTPException(404, "Document not found.")
    return doc


@router.get("/documents/{doc_id}/file")
async def document_file(doc_id: int, user: CurrentUser, s: DB) -> FileResponse:
    doc = await readable_doc(s, user, doc_id)
    if not Path(doc.file_path).is_file():
        raise HTTPException(404, "The file for this document is missing.")
    return FileResponse(doc.file_path, filename=f"{doc.title}.{doc.format}")


@router.post("/documents", status_code=201)
async def upload_document(
    user: CurrentUser,
    s: DB,
    file: Annotated[UploadFile, File()],
    access_: Annotated[str, Form(alias="access")],
    is_public: Annotated[bool, Form()] = False,
) -> DocumentOut:
    if not access.can_manage(user, access_):
        raise HTTPException(403, "You can only add documents to your own departments.")
    if is_public and user.role != Role.admin:
        raise HTTPException(403, "Only an admin can make a document public.")
    if is_public and access_ != EVERYONE:
        raise HTTPException(400, "Public documents must be visible to Everyone.")
    if access_ != EVERYONE and not await s.scalar(
        select(Department.id).where(Department.org_id == user.org_id, Department.name == access_)
    ):
        raise HTTPException(400, f"There is no department called {access_}.")
    data = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    try:
        fmt = uploads.check_upload(file.filename or "", data)
    except ValueError as e:
        raise HTTPException(400, str(e)) from None
    digest = uploads.sha256(data)
    if await s.scalar(
        select(Document.id).where(Document.org_id == user.org_id, Document.sha256 == digest)
    ):
        raise HTTPException(409, "This file is already in the library.")
    doc = Document(
        org_id=user.org_id,
        title=Path(file.filename or "Untitled").stem.replace("_", " "),
        access=access_,
        is_public=is_public,
        format=fmt,
        sha256=digest,
        file_path=uploads.save(user.org.slug, digest, fmt, data),
        meta={"uploaded_by": user.email},
    )
    s.add(doc)
    await s.commit()
    await s.refresh(doc)
    queue_ingest(doc.id)
    return DocumentOut.model_validate(doc)


def queue_ingest(doc_id: int) -> None:
    from atlas_api.worker import ingest_document

    ingest_document.delay(doc_id)


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(doc_id: int, user: CurrentUser, s: DB) -> Response:
    doc = await readable_doc(s, user, doc_id)
    if not access.can_manage(user, doc.access):
        raise HTTPException(403, "Only an admin or this department's manager can delete it.")
    if await s.scalar(text(f"SELECT to_regclass('{CHUNKS_TABLE}')")):
        await s.execute(
            text(f"DELETE FROM {CHUNKS_TABLE} WHERE metadata_->>'document_id' = :id"),
            {"id": str(doc.id)},
        )
    path = Path(doc.file_path)
    await s.delete(doc)
    await s.commit()
    # Corpus files are mounted read-only; only uploads are ours to remove.
    if path.is_relative_to(settings.files_dir):
        path.unlink(missing_ok=True)
    return Response(status_code=204)


@router.get("/departments")
async def departments(user: CurrentUser, s: DB) -> list[DepartmentOut]:
    members = func.count(user_departments.c.user_id)
    rows = await s.execute(
        select(Department.name, Department.description, members)
        .outerjoin(user_departments, user_departments.c.department_id == Department.id)
        .where(Department.org_id == user.org_id)
        .group_by(Department.id)
        .order_by(Department.name)
    )
    return [DepartmentOut(name=n, description=d, members=m) for n, d, m in rows]
