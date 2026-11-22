import os

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
    # jina-reranker-v1-turbo-en scale; -1.1 = middle of the best range with the relevance grade
    # (evals/results/20261122T142654Z-grade-relevance.json: accuracy 0.968). MiniLM used 1.3.
    grade_threshold: float = -1.1
    # LLM relevance grade after the score threshold (corrective RAG, Phase 6): the `fast` model
    # checks the passages really answer; only the passages it marks go to the answer model.
    relevance_grade: bool = True
    # RedisVL semantic cache needs Redis with the query engine (redis:8 or Redis Stack).
    semantic_cache: bool = False
    cache_similarity: float = 0.95
    cache_ttl_s: int = 24 * 3600
    # Super admin login (docs/API.md). Empty = super login disabled.
    superadmin_email: str = ""
    superadmin_password_hash: str = ""
    session_secret: str = ""
    # Website chat (Phase 8). The app's own origin: the /embed iframe calls the public API from
    # here, so it is always allowed next to each company's allowed_origins.
    app_origin: str = "https://p10.kanav.space"
    visitor_max_tokens: int = 400  # answer token cap for website visitors
    visitor_history_h: int = 24  # visitor thread memory (LangGraph checkpointer) lifetime

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("+asyncpg", "+psycopg2")

    @property
    def psycopg_url(self) -> str:
        """Plain libpq URL for psycopg 3 (the LangGraph checkpointer)."""
        return self.database_url.replace("postgresql+asyncpg", "postgresql")


settings = Settings()


def langsmith_tracing() -> bool:
    """LangSmith tracing uses LangChain's standard env vars (LANGSMITH_TRACING, LANGSMITH_API_KEY,
    LANGSMITH_PROJECT, LANGSMITH_ENDPOINT). It is on only when both the switch and a key are set;
    otherwise the switch is forced off so LangChain never tries to send traces."""
    on = os.environ.get("LANGSMITH_TRACING", "").strip().lower() in ("1", "true", "yes")
    if on and os.environ.get("LANGSMITH_API_KEY", "").strip():
        # Compose passes unset variables as empty strings: fill or drop them.
        if not os.environ.get("LANGSMITH_PROJECT", "").strip():
            os.environ["LANGSMITH_PROJECT"] = "atlas-v2"
        if not os.environ.get("LANGSMITH_ENDPOINT", "").strip():
            os.environ.pop("LANGSMITH_ENDPOINT", None)
        return True
    os.environ["LANGSMITH_TRACING"] = "false"
    os.environ["LANGCHAIN_TRACING_V2"] = "false"
    return False


tracing = langsmith_tracing()
