"""HNSW index (cosine) on chunk embeddings, for databases where LlamaIndex made the table.

Revision ID: 0003
Revises: 0002
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
          IF to_regclass('public.data_chunks') IS NOT NULL THEN
            CREATE INDEX IF NOT EXISTS data_chunks_embedding_hnsw
              ON data_chunks USING hnsw (embedding vector_cosine_ops)
              WITH (m = 16, ef_construction = 64);
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS data_chunks_embedding_hnsw")
