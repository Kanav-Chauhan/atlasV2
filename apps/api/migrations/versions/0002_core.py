"""orgs, departments, users, documents

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

role = postgresql.ENUM("admin", "manager", "member", "guest", name="role")
status = postgresql.ENUM("queued", "processing", "ready", "failed", name="doc_status")


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("slug", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("industry", sa.String(200), nullable=False, server_default=""),
    )
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "org_id",
            sa.Integer,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.UniqueConstraint("org_id", "name"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "org_id",
            sa.Integer,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("title", sa.String(200), nullable=False, server_default=""),
        sa.Column("role", role, nullable=False),
        sa.Column("guest_until", sa.Date),
    )
    op.create_table(
        "user_departments",
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "department_id",
            sa.Integer,
            sa.ForeignKey("departments.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "org_id",
            sa.Integer,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("doc_no", sa.String(100)),
        sa.Column("access", sa.String(100), nullable=False),
        sa.Column("is_public", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("format", sa.String(10), nullable=False),
        sa.Column("status", status, nullable=False, server_default="queued"),
        sa.Column("error", sa.Text),
        sa.Column("file_path", sa.Text, nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("pages", sa.Integer),
        sa.Column("chunks", sa.Integer),
        sa.Column("version", sa.String(50)),
        sa.Column("effective", sa.String(50)),
        sa.Column("superseded_by", sa.Text),
        sa.Column("meta", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "sha256"),
    )


def downgrade() -> None:
    for t in ("documents", "user_departments", "users", "departments", "organizations"):
        op.drop_table(t)
    status.drop(op.get_bind())
    role.drop(op.get_bind())
