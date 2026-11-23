"""Phase 10 waitlist: POST /public/waitlist → Clerk (faked here), and the Clerk list mapping."""

from typing import Any

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from atlas_api import waitlist
from atlas_api.main import app
from atlas_api.settings import settings


@pytest.fixture
def clerk(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    added: list[str] = []
    hits: dict[str, int] = {}

    async def fake_add(email: str) -> None:
        added.append(email)

    async def fake_limit(key: str, limit: int, ttl: int) -> bool:
        hits[key] = hits.get(key, 0) + 1
        return hits[key] <= limit

    monkeypatch.setattr(settings, "clerk_secret_key", "sk_test_x")
    monkeypatch.setattr(waitlist, "add", fake_add)
    monkeypatch.setattr(waitlist, "under_limit", fake_limit)
    return added


def client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_join_adds_the_normalised_email(clerk: list[str]) -> None:
    async with client() as c:
        r = await c.post("/public/waitlist", json={"email": "  Riya@Example.COM "})
    assert r.status_code == 204
    assert clerk == ["riya@example.com"]


@pytest.mark.parametrize(
    ("body", "status"),
    [
        ({"email": "not-an-email"}, 422),
        ({"email": "a@b"}, 422),
        ({"email": "x" * 250 + "@a.io"}, 422),
        ({"email": "bot@example.com", "website": "spam.example"}, 400),
    ],
)
async def test_join_rejects(clerk: list[str], body: dict[str, Any], status: int) -> None:
    async with client() as c:
        assert (await c.post("/public/waitlist", json=body)).status_code == status
    assert clerk == []


async def test_join_is_rate_limited_per_ip(clerk: list[str]) -> None:
    async with client() as c:
        codes = [
            (await c.post("/public/waitlist", json={"email": f"p{i}@example.com"})).status_code
            for i in range(waitlist.PER_IP_PER_HOUR + 1)
        ]
    assert codes[-1] == 429 and set(codes[:-1]) == {204}


async def test_join_closed_without_a_clerk_key(
    clerk: list[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "clerk_secret_key", "")
    async with client() as c:
        assert (await c.post("/public/waitlist", json={"email": "a@b.co"})).status_code == 503


async def test_entries_maps_clerk_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(req: httpx.Request) -> httpx.Response:
        assert req.headers["Authorization"] == "Bearer sk_test_x"
        assert req.url.params["order_by"] == "-created_at"
        row = {
            "id": "wle_1",
            "email_address": "a@b.co",
            "status": "pending",
            "created_at": 1795360058317,
        }
        return httpx.Response(200, json={"data": [row], "total_count": 1})

    real = httpx.AsyncClient
    monkeypatch.setattr(settings, "clerk_secret_key", "sk_test_x")
    monkeypatch.setattr(
        "atlas_api.waitlist.httpx.AsyncClient",
        lambda **kw: real(transport=httpx.MockTransport(handler), **kw),
    )
    assert await waitlist.entries() == [
        {"id": "wle_1", "email": "a@b.co", "status": "pending", "created_at": 1795360058317}
    ]
