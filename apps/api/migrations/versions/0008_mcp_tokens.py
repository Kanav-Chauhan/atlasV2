"""MCP server (Phase 9): api_tokens (sha256 hash only, bound to one person) and mcp_audit.

Revision ID: 0008
Revises: 0007
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "api_tokens",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "org_id",
            sa.Integer,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "mcp_audit",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "org_id",
            sa.Integer,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "token_id",
            sa.Integer,
            sa.ForeignKey("api_tokens.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("tool", sa.String(64), nullable=False),
        sa.Column("args_summary", sa.String(300), nullable=False),
        sa.Column("ok", sa.Boolean, nullable=False),
        sa.Column("latency_ms", sa.Integer, nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("mcp_audit")
    op.drop_table("api_tokens")
