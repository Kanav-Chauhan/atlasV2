"""Team for big companies (UI phase 5): organizations.auto_join = email-domain auto-join
settings {domains, role, departments}; empty = off. A GIN index on the domains makes the
sign-in lookup ("which company owns @acme.com?") cheap.

Revision ID: 0012
Revises: 0011
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("auto_join", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index(
        "ix_organizations_auto_join_domains",
        "organizations",
        [sa.text("(auto_join -> 'domains')")],
        postgresql_using="gin",
    )
    # Directory search sorts and pages by name inside one company.
    op.create_index("ix_users_org_name", "users", ["org_id", "name"])


def downgrade() -> None:
    op.drop_index("ix_users_org_name", table_name="users")
    op.drop_index("ix_organizations_auto_join_domains", table_name="organizations")
    op.drop_column("organizations", "auto_join")
