from fastapi import FastAPI, Response
from sqlalchemy import text

from atlas_api import (
    chat_routes,
    insights_routes,
    mcp_server,
    routes,
    super_routes,
    team_routes,
    token_routes,
    website_routes,
)
from atlas_api.db import engine, redis

app = FastAPI(title="Atlas v2 API", lifespan=mcp_server.lifespan)


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


app.include_router(routes.router)
app.include_router(chat_routes.router)
app.include_router(team_routes.router)
app.include_router(insights_routes.router)
app.include_router(super_routes.router)
app.include_router(website_routes.router)
app.include_router(token_routes.router)
app.router.routes.append(mcp_server.route)  # MCP Streamable HTTP (Phase 9)
