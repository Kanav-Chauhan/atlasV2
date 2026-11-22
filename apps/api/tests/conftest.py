"""Shared fixtures. Plan limits (plans.py) are switched off unless a test asks for them
(`@pytest.mark.limits`): most tests don't run Redis and aren't about limits."""

from collections.abc import Iterator

import pytest

from atlas_api import plans


@pytest.fixture(autouse=True)
def _no_plan_limits(
    request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch
) -> Iterator[None]:
    if request.node.get_closest_marker("limits") is None:

        async def no_count(*_: object, **__: object) -> None:
            return None

        async def no_check(*_: object) -> None:
            return None

        monkeypatch.setattr(plans, "count_question", no_count)
        monkeypatch.setattr(plans, "check_documents", no_check)
        monkeypatch.setattr(plans, "check_people", no_check)
    yield
