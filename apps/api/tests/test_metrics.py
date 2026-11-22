"""Phase 11 metrics: route templates as labels (bounded), answer outcomes."""

from httpx import ASGITransport, AsyncClient
from prometheus_client import REGISTRY

from atlas_api import metrics
from atlas_api.main import app


def value(name: str, labels: dict[str, str]) -> float:
    return REGISTRY.get_sample_value(name, labels) or 0.0


async def test_requests_are_labelled_by_route_template() -> None:
    labels = {"method": "GET", "route": "/health", "status": "200"}
    before = value("atlas_http_requests_total", labels)
    unknown = {"method": "GET", "route": "unmatched", "status": "404"}
    before_unknown = value("atlas_http_requests_total", unknown)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        await c.get("/health")
        await c.get("/no/such/path/123")
    assert value("atlas_http_requests_total", labels) == before + 1
    assert value("atlas_http_requests_total", unknown) == before_unknown + 1


def test_answer_outcomes() -> None:
    def n(who: str, outcome: str) -> float:
        return value("atlas_answers_total", {"who": who, "outcome": outcome})

    start = {k: n("staff", k) for k in ("answered", "not_found", "cached", "other")}
    metrics.answer("staff", "rag", False, False, 1200)
    metrics.answer("staff", "rag", True, False, 900)
    metrics.answer("staff", "rag", False, True, 50)
    metrics.answer("staff", "smalltalk", False, False, 30)
    assert {k: n("staff", k) - v for k, v in start.items()} == {
        "answered": 1,
        "not_found": 1,
        "cached": 1,
        "other": 1,
    }
