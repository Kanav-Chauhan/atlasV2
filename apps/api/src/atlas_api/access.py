"""The one access rule (docs/API.md). Every endpoint goes through here."""

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


def can_manage(user: User, access: str) -> bool:
    """Upload into / delete from `access`: admin anywhere, manager in own departments only."""
    return user.role == Role.admin or (
        user.role == Role.manager and access in user.department_names
    )
