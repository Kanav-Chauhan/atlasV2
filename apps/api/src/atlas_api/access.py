"""The one access rule (docs/API.md). Every endpoint goes through here."""

from llama_index.core.vector_stores import (
    FilterCondition,
    FilterOperator,
    MetadataFilter,
    MetadataFilters,
)
from sqlalchemy import ColumnElement, and_, or_, true

from atlas_api.models import EVERYONE, Document, Role, User


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


def chunk_filters(user: User) -> MetadataFilters:
    """can_read as LlamaIndex metadata filters on chunks (PGVectorStore turns them into SQL)."""
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
