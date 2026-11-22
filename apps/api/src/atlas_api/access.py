"""The one access rule (docs/API.md). Every endpoint goes through here."""

from dataclasses import dataclass
from typing import Literal

from llama_index.core.vector_stores import (
    FilterCondition,
    FilterOperator,
    MetadataFilter,
    MetadataFilters,
)
from sqlalchemy import ColumnElement, and_, or_, true

from atlas_api.models import EVERYONE, Document, Role, User


@dataclass(frozen=True)
class Visitor:
    """A website visitor (Phase 8): a built-in principal that reads only the public documents
    of one company. It has no departments, no chat history beyond its thread, no name."""

    org_id: int
    kind: Literal["visitor"] = "visitor"


Principal = User | Visitor


def can_read(user: User, doc: Document) -> bool:
    return doc.org_id == user.org_id and (
        user.role == Role.admin or doc.access == EVERYONE or doc.access in user.department_names
    )


def readable(user: User) -> ColumnElement[bool]:
    """can_read as a SQL WHERE clause on documents."""
    return and_(
        Document.org_id == user.org_id,
        true()
        if user.role == Role.admin
        else or_(Document.access == EVERYONE, Document.access.in_(user.department_names)),
    )


def _sql(value: str) -> str:
    # PGVectorStore pastes filter values into the SQL text, so quotes must be escaped here.
    return value.replace("'", "''")


def public_filters(org_id: int) -> MetadataFilters:
    """What a website visitor may retrieve: org_id == X AND is_public == true.
    is_public is a JSON boolean in chunk metadata; PGVectorStore compares `metadata_->>key` as
    text, so the value is the string "true" (a Python True would become a float cast)."""
    return MetadataFilters(
        filters=[
            MetadataFilter(key="org_id", value=org_id),
            MetadataFilter(key="is_public", value="true"),
        ]
    )


def chunk_filters(user: Principal) -> MetadataFilters:
    """can_read as LlamaIndex metadata filters on chunks (PGVectorStore turns them into SQL)."""
    if isinstance(user, Visitor):
        return public_filters(user.org_id)
    org = MetadataFilter(key="org_id", value=user.org_id)
    if user.role == Role.admin:
        return MetadataFilters(filters=[org])
    sees: list[MetadataFilter | MetadataFilters] = [
        MetadataFilter(key="access", value=_sql(EVERYONE))
    ]
    if user.department_names:  # "IN ()" is not valid SQL
        sees.append(
            MetadataFilter(
                key="access",
                operator=FilterOperator.IN,
                value=sorted(_sql(d) for d in user.department_names),
            )
        )
    return MetadataFilters(
        filters=[org, MetadataFilters(filters=sees, condition=FilterCondition.OR)]
    )


def can_manage(user: User, access: str) -> bool:
    """Upload into / delete from `access`: admin anywhere, manager in own departments only."""
    return user.role == Role.admin or (
        user.role == Role.manager and access in user.department_names
    )


# ------------------------------------------------------------------ Phase 7: team rules
# admin = whole company; manager = people in own departments, and may add/change/remove only
# members and guests whose departments are all their own. Members and guests: nothing.

LEADS = (Role.admin, Role.manager)
# Every manager is in this shared department (for manager-only documents). It must not widen
# their team scope: the HR manager manages HR people, not every manager. Admins manage it.
MANAGERS = "Managers"


def team_scope(actor: User) -> set[str]:
    """Departments whose people `actor` manages: admin all (call sites check), manager own
    departments except the shared Managers one."""
    return actor.department_names - {MANAGERS} if actor.role == Role.manager else set()


def sees_person(actor: User, depts: set[str]) -> bool:
    return actor.role == Role.admin or bool(depts & team_scope(actor))


def can_manage_person(actor: User, role: Role, depts: set[str]) -> bool:
    """May `actor` create, or hold under their control, a person with this role and departments."""
    return actor.role == Role.admin or (
        actor.role == Role.manager
        and role in (Role.member, Role.guest)
        and bool(depts)
        and depts <= team_scope(actor)
    )


def role_change_error(actor: User, target: User, new_role: Role, admins: int) -> str | None:
    if new_role == target.role:
        return None
    if target.id == actor.id:
        return "You can't change your own role."
    if target.role == Role.admin and admins <= 1:
        return "This is the last admin; make someone else admin first."
    return None


def delete_error(actor: User, target: User, admins: int) -> str | None:
    if target.id == actor.id:
        return "You can't remove yourself."
    if target.role == Role.admin and admins <= 1:
        return "This is the last admin; make someone else admin first."
    return None
