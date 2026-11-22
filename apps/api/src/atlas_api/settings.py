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

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("+asyncpg", "+psycopg2")


settings = Settings()
