from redis.asyncio import Redis
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

from atlas_api.settings import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
Session = async_sessionmaker(engine, expire_on_commit=False)
redis = Redis.from_url(settings.redis_url)

# Scripts and the Celery worker are sync.
sync_engine = create_engine(settings.sync_database_url, pool_pre_ping=True)
SyncSession = sessionmaker(sync_engine, expire_on_commit=False)

# LlamaIndex's PGVectorStore prefixes its table with "data_".
CHUNKS_TABLE = "data_chunks"
