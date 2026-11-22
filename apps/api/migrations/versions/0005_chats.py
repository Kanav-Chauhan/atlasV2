"""chats, messages, document_requests (Phase 5). The LangGraph checkpointer creates its own
checkpoint tables at API start (AsyncPostgresSaver.setup()).

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def _now() -> sa.Column[sa.DateTime]:
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )


def upgrade() -> None:
    op.create_table(
        "chats",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "org_id",
            sa.Integer,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        _now(),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_chats_user_updated", "chats", ["user_id", "updated_at"])
    op.create_table(
        "messages",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "chat_id",
            sa.String(64),
            sa.ForeignKey("chats.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("route", sa.String(16)),
        sa.Column("abstained", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("cached", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("rewritten_query", sa.Text),
        sa.Column("sources", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("language", sa.String(8)),
        sa.Column("latency_ms", sa.Integer),
        sa.Column("feedback", sa.String(8)),
        sa.Column("comment", sa.Text),
        _now(),
    )
    op.create_table(
        "document_requests",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "org_id",
            sa.Integer,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("note", sa.Text),
        _now(),
    )


def downgrade() -> None:
    op.drop_table("document_requests")
    op.drop_table("messages")
    op.drop_table("chats")
