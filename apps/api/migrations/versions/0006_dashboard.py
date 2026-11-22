"""organizations.description, users.last_active (Phase 7 dashboard).

Revision ID: 0006
Revises: 0005
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organizations", sa.Column("description", sa.Text, nullable=False, server_default="")
    )
    op.add_column("users", sa.Column("last_active", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("users", "last_active")
    op.drop_column("organizations", "description")
