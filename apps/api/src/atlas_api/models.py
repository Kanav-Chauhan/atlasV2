import enum
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Role(enum.StrEnum):
    admin = "admin"
    manager = "manager"
    member = "member"
    guest = "guest"


class Status(enum.StrEnum):
    queued = "queued"
    processing = "processing"
    ready = "ready"
    failed = "failed"


EVERYONE = "Everyone"

user_departments = Table(
    "user_departments",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("department_id", ForeignKey("departments.id", ondelete="CASCADE"), primary_key=True),
)


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    industry: Mapped[str] = mapped_column(String(200), default="")


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (UniqueConstraint("org_id", "name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default="")


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(200), default="")
    role: Mapped[Role] = mapped_column(Enum(Role, name="role"))
    guest_until: Mapped[date | None] = mapped_column(Date)
    org: Mapped[Organization] = relationship(lazy="joined")
    departments: Mapped[list[Department]] = relationship(
        secondary=user_departments, lazy="selectin"
    )

    @property
    def department_names(self) -> set[str]:
        return {d.name for d in self.departments}


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint("org_id", "sha256"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(300))
    doc_no: Mapped[str | None] = mapped_column(String(100))
    access: Mapped[str] = mapped_column(String(100))
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    format: Mapped[str] = mapped_column(String(10))
    status: Mapped[Status] = mapped_column(Enum(Status, name="doc_status"), default=Status.queued)
    error: Mapped[str | None] = mapped_column(Text)
    file_path: Mapped[str] = mapped_column(Text)
    sha256: Mapped[str] = mapped_column(String(64))
    pages: Mapped[int | None] = mapped_column(Integer)
    chunks: Mapped[int | None] = mapped_column(Integer)
    version: Mapped[str | None] = mapped_column(String(50))
    effective: Mapped[str | None] = mapped_column(String(50))
    superseded_by: Mapped[str | None] = mapped_column(Text)
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class EvalRun(Base):
    __tablename__ = "eval_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # {mode: {hit_at_1, hit_at_3, hit_at_5, mrr, context_recall, leaks, n}}
    modes: Mapped[dict[str, Any]] = mapped_column(JSONB)


class Chat(Base):
    """One conversation thread. The id comes from the browser (AI SDK `useChat` id)."""

    __tablename__ = "chats"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    chat_id: Mapped[str] = mapped_column(ForeignKey("chats.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))  # user | assistant
    text: Mapped[str] = mapped_column(Text)
    route: Mapped[str | None] = mapped_column(String(16))
    abstained: Mapped[bool] = mapped_column(Boolean, default=False)
    cached: Mapped[bool] = mapped_column(Boolean, default=False)
    rewritten_query: Mapped[str | None] = mapped_column(Text)
    sources: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    language: Mapped[str | None] = mapped_column(String(8))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    feedback: Mapped[str | None] = mapped_column(String(8))  # up | down
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DocumentRequest(Base):
    """ "Request a document" from a not-found answer (shown in Insights)."""

    __tablename__ = "document_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    question: Mapped[str] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
