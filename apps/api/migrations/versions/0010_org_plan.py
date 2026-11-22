"""Organization plan (Phase 10: plans and limits). Existing companies get `pro`, the three
demo companies `demo`.

Revision ID: 0010
Revises: 0009
"""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("plan", sa.String(20), nullable=False, server_default="pro"),
    )
    op.execute(
        "UPDATE organizations SET plan = 'demo' WHERE slug IN ('nimbus', 'sanjeevani', 'kaveri')"
    )


def downgrade() -> None:
    op.drop_column("organizations", "plan")
