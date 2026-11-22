"""Website chat (Phase 8): organizations.website_chat, visitor chats (chats.user_id nullable,
chats.origin). The 3 demo companies get it enabled for p10 with random site keys.

Revision ID: 0007
Revises: 0006
"""

import json
import secrets

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

DEMO = ("nimbus", "sanjeevani", "kaveri")


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("website_chat", postgresql.JSONB, nullable=False, server_default="{}"),
    )
    op.execute(
        "CREATE UNIQUE INDEX ux_org_site_key ON organizations ((website_chat->>'site_key')) "
        "WHERE website_chat->>'site_key' <> ''"
    )
    op.alter_column("chats", "user_id", existing_type=sa.Integer, nullable=True)
    op.add_column("chats", sa.Column("origin", sa.String(300)))
    op.create_index(
        "ix_chats_visitor", "chats", ["org_id", "created_at"], postgresql_where="user_id IS NULL"
    )
    conn = op.get_bind()
    for slug in DEMO:
        cfg = {
            "enabled": True,
            "site_key": secrets.token_urlsafe(16),
            "allowed_origins": ["https://p10.kanav.space"],
        }
        conn.execute(
            sa.text("UPDATE organizations SET website_chat = CAST(:c AS jsonb) WHERE slug = :s"),
            {"c": json.dumps(cfg), "s": slug},
        )


def downgrade() -> None:
    op.drop_index("ix_chats_visitor", "chats")
    op.execute("DELETE FROM chats WHERE user_id IS NULL")
    op.drop_column("chats", "origin")
    op.alter_column("chats", "user_id", existing_type=sa.Integer, nullable=False)
    op.execute("DROP INDEX ux_org_site_key")
    op.drop_column("organizations", "website_chat")
