import pytest
from httpx import ASGITransport, AsyncClient

from atlas_api.main import app


def client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_health() -> None:
    async with client() as c:
        r = await c.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


@pytest.mark.integration
async def test_ready() -> None:
    async with client() as c:
        r = await c.get("/health/ready")
    assert r.status_code == 200, r.json()
    assert r.json() == {"postgres": "ok", "redis": "ok"}
