"""Answer eval run summaries (Phase 6: RAGAS + correct / not-found / leaks / latency).

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "answer_eval_runs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("run_id", sa.String(64), nullable=False, unique=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("summary", postgresql.JSONB, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("answer_eval_runs")
