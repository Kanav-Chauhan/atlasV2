"""Retrieval eval run summaries (GET /evals/latest); HNSW iterative scan.

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "eval_runs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("run_id", sa.String(64), nullable=False, unique=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("modes", postgresql.JSONB, nullable=False),
    )
    # The permission filter runs after the HNSW scan; without iterative scan a filtered query
    # can return fewer than top_k rows (pgvector >= 0.8 keeps scanning until LIMIT is met).
    op.execute(
        "DO $$ BEGIN EXECUTE format("
        "'ALTER DATABASE %I SET hnsw.iterative_scan = strict_order', current_database()); END $$"
    )


def downgrade() -> None:
    op.execute(
        "DO $$ BEGIN EXECUTE format("
        "'ALTER DATABASE %I RESET hnsw.iterative_scan', current_database()); END $$"
    )
    op.drop_table("eval_runs")
