from fastapi import FastAPI, Response
from sqlalchemy import text

from atlas_api.db import engine, redis

app = FastAPI(title="Atlas v2 API")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
async def ready(response: Response) -> dict[str, str]:
    checks = {}
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as e:
        checks["postgres"] = f"error: {type(e).__name__}"
    try:
        await redis.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {type(e).__name__}"
    if any(v != "ok" for v in checks.values()):
        response.status_code = 503
    return checks
