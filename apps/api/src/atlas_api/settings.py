from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ATLAS_")

    database_url: str = "postgresql+asyncpg://atlas:atlas@localhost:5432/atlas"
    redis_url: str = "redis://localhost:6379/0"
    llm_base_url: str = "http://ai-gateway:4000/v1"
    llm_api_key: str = ""
    files_dir: str = "/data/files"
    corpus_dir: str = "/corpus"
    models_dir: str = "/models"
    max_upload_mb: int = 10
    # bge-reranker-base needs ~1.9 GB RAM and ~12 s per query on this VPS; MiniLM ~0.4 GB, ~3 s.
    reranker_model: str = "Xenova/ms-marco-MiniLM-L-6-v2"
    # Gateway model names (~/deploy/ai-gateway/config.yaml).
    llm_fast: str = "fast"
    llm_smart: str = "smart"
    llm_smart_fallbacks: str = "smart-groq,smart-cf"
    # Top reranked score below which retrieval counts as weak (scripts/calibrate_grade.py).
    grade_threshold: float = 1.3
    # RedisVL semantic cache needs Redis with the query engine (redis:8 or Redis Stack).
    semantic_cache: bool = False
    cache_similarity: float = 0.95
    cache_ttl_s: int = 24 * 3600
    # Super admin login (docs/API.md). Empty = super login disabled.
    superadmin_email: str = ""
    superadmin_password_hash: str = ""
    session_secret: str = ""

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("+asyncpg", "+psycopg2")

    @property
    def psycopg_url(self) -> str:
        """Plain libpq URL for psycopg 3 (the LangGraph checkpointer)."""
        return self.database_url.replace("postgresql+asyncpg", "postgresql")


settings = Settings()
