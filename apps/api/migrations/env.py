import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from atlas_api.settings import settings

if context.config.config_file_name:
    fileConfig(context.config.config_file_name)


def run(conn: Connection) -> None:
    context.configure(connection=conn, target_metadata=None)
    with context.begin_transaction():
        context.run_migrations()


async def main() -> None:
    engine = create_async_engine(settings.database_url)
    async with engine.connect() as conn:
        await conn.run_sync(run)
    await engine.dispose()


asyncio.run(main())
