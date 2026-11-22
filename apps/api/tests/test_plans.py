"""Phase 10 plans and limits (plans.py) with an in-memory Redis stand-in."""

from typing import Any

import pytest
from fastapi import HTTPException

from atlas_api import plans
from atlas_api.models import Organization

pytestmark = pytest.mark.limits


class FakeRedis:
    def __init__(self) -> None:
        self.data: dict[str, int] = {}

    async def incr(self, key: str) -> int:
        self.data[key] = self.data.get(key, 0) + 1
        return self.data[key]

    async def expire(self, key: str, ttl: int) -> None:
        return None

    async def get(self, key: str) -> Any:
        return self.data.get(key)


@pytest.fixture
def redis(monkeypatch: pytest.MonkeyPatch) -> FakeRedis:
    fake = FakeRedis()
    monkeypatch.setattr(plans, "redis", fake)
    return fake


def org(plan: str, id: int = 1) -> Organization:
    return Organization(id=id, slug=f"o{id}", name="Acme Ltd", plan=plan)


async def test_pro_stops_at_the_monthly_limit(
    redis: FakeRedis, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(plans.PLANS, "pro", plans.Limits(questions_month=3, documents=1, people=1))
    o = org("pro")
    for _ in range(3):
        await plans.count_question(o)
    with pytest.raises(HTTPException) as e:
        await plans.count_question(o)
    assert e.value.status_code == 429 and "3 questions" in e.value.detail
    assert await plans.questions_used(o.id) == 4
    await plans.count_question(org("pro", id=2))  # another company has its own count


async def test_demo_caps_each_visitor_per_day(
    redis: FakeRedis, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(
        plans.PLANS,
        "demo",
        plans.Limits(
            questions_month=None, documents=None, people=None, questions_day_per_visitor=2
        ),
    )
    o = org("demo")
    await plans.count_question(o, "1.1.1.1")
    await plans.count_question(o, "1.1.1.1")
    with pytest.raises(HTTPException) as e:
        await plans.count_question(o, "1.1.1.1")
    assert e.value.status_code == 429 and "per visitor" in e.value.detail
    await plans.count_question(o, "2.2.2.2")  # someone else is fine
    await plans.count_question(o)  # no IP (website visitors, agents): no per-visitor cap


async def test_enterprise_and_unknown_plans(redis: FakeRedis) -> None:
    for _ in range(10):
        await plans.count_question(org("enterprise"))
    assert plans.limits(org("something-old")) == plans.PLANS["pro"]


class FakeSession:
    def __init__(self, n: int) -> None:
        self.n = n

    async def scalar(self, _: Any) -> int:
        return self.n


async def test_document_and_people_caps() -> None:
    pro = org("pro")
    cap = plans.PLANS["pro"]
    await plans.check_documents(FakeSession(cap.documents - 1), pro)  # type: ignore[arg-type, operator]
    with pytest.raises(HTTPException) as e:
        await plans.check_documents(FakeSession(cap.documents), pro)  # type: ignore[arg-type]
    assert e.value.status_code == 403
    with pytest.raises(HTTPException):
        await plans.check_people(FakeSession(cap.people), pro)  # type: ignore[arg-type]
    await plans.check_people(FakeSession(10_000), org("enterprise"))  # type: ignore[arg-type]
