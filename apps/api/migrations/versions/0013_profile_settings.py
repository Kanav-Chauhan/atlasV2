"""Settings + profile (UI phase 8): organizations.settings = admin preferences
{access_defaults: {role, departments, guest_days}, notifications: {weekly_summary,
review_reminders}, logo: <version>} (read through profile_routes.org_settings());
users.avatar = version of the person's uploaded picture (None = initials). The images
themselves are files under <files_dir>/<org slug>/images/.

Revision ID: 0013
Revises: 0012
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("settings", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column("users", sa.Column("avatar", sa.String(16), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar")
    op.drop_column("organizations", "settings")
