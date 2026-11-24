"""Chat memory and dates: follow-ups keep their subject, the memory stays small, and answers that
depend on the day (or differ by a number) never come from the cache."""

from datetime import date
from typing import Any

import pytest
from langchain_core.messages import AIMessage, AnyMessage, HumanMessage
from langgraph.checkpoint.memory import InMemorySaver
from test_chat import FakeCache, FakeModels, make_ctx, run

from atlas_api import graph, llm, when
from atlas_api.cache import AnswerCache
from atlas_api.llm import RewriteOut


def test_dates_are_worked_out_for_the_model() -> None:
    line = when.today_line(date(2026, 11, 24))
    assert "Today is Tuesday 24 November 2026" in line
    assert "tomorrow is Wednesday 25 November 2026" in line
    assert "one month from tomorrow is Friday 25 December 2026" in line
    assert when.next_month(date(2027, 1, 31)) == date(2027, 2, 28)
    assert when.next_month(date(2026, 12, 5)) == date(2027, 1, 5)


@pytest.mark.parametrize(
    ("text", "dated"),
    [
        ("is it holiday tom", True),
        ("what about next month this date", True),
        ("kal chutti hai kya", True),
        ("कल छुट्टी है?", True),
        ("How many earned leave days do I get?", False),
        ("Is 25 December 2026 a holiday?", False),
    ],
)
def test_relative(text: str, dated: bool) -> None:
    assert when.relative(text) is dated


def chat(n: int, answer: str = "x" * 3000) -> list[AnyMessage]:
    out: list[AnyMessage] = []
    for i in range(n):
        out.append(HumanMessage(f"said {i}"))
        out.append(AIMessage(answer, additional_kwargs={"query": f"standalone {i}"}))
    return out


def test_memory_stays_small_in_a_long_chat() -> None:
    text = llm.history_text(chat(200))
    assert len(text) <= llm.MEMORY_CHARS + 100
    assert "standalone 199" in text and "said 199" in text
    assert "- standalone 190" in text  # older: the question only
    assert "standalone 150" not in text
    assert llm.last_standalone(chat(3)) == "standalone 2"


def test_memory_reads_chats_from_before_this_change() -> None:
    old: list[AnyMessage] = [HumanMessage("leave days?"), AIMessage("18 days [1].")]
    assert llm.history_text(old) == "User: leave days?\nAtlas: 18 days [1]."
    assert llm.last_standalone(old) == ""


class Holiday(FakeModels):
    fail = False

    async def rewrite(self, question: str, org: str, history: str) -> RewriteOut:
        self.histories.append(history)
        if "next month" in question:
            if self.fail:
                raise RuntimeError("gateway down")
            return RewriteOut(query="Is 25 December 2026 a holiday at Nimbus?", used_history=True)
        return RewriteOut(query="Is 25 November 2026 a holiday at Nimbus?", used_history=False)


async def test_next_month_this_date_remembers_the_holiday_question() -> None:
    models, cache = Holiday(), FakeCache()
    ctx = make_ctx(models, cache=cache)
    g = graph.build(InMemorySaver())
    await run(g, "is it holiday tom", ctx, "u:c")
    _, final = await run(g, "what about next month this date", ctx, "u:c")
    assert "meaning: Is 25 November 2026 a holiday at Nimbus?" in models.histories[1]
    assert final["query"] == "Is 25 December 2026 a holiday at Nimbus?"
    assert cache.data == {}  # asked about a day: never reused tomorrow


async def test_follow_up_keeps_its_subject_when_the_rewrite_fails() -> None:
    models = Holiday()
    models.fail = True
    ctx = make_ctx(models)
    g = graph.build(InMemorySaver())
    await run(g, "is it holiday tom", ctx, "u:c")
    _, final = await run(g, "what about next month this date", ctx, "u:c")
    assert final["query"] == "Is 25 December 2026 a holiday at Nimbus?"


async def test_cache_refuses_a_near_match_with_another_number(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Store:
        async def acheck(self, **kw: Any) -> list[dict[str, Any]]:
            return [{"prompt": "Is 25 December 2026 a holiday?", "response": '{"answer": "Yes"}'}]

    c = AnswerCache()
    c._cache = Store()

    async def vector(text: str) -> list[float]:
        return [0.0]

    async def tag(org_id: int, key: str) -> str:
        return key

    monkeypatch.setattr(AnswerCache, "_vector", staticmethod(vector))
    monkeypatch.setattr("atlas_api.cache._tag", tag)
    assert await c.lookup("is 25 dec 2026 a holiday", "s", 1) == {"answer": "Yes"}
    assert await c.lookup("Is 26 December 2026 a holiday?", "s", 1) is None
    assert await c.lookup("Is 25 November 2026 a holiday?", "s", 1) is None


async def test_a_one_day_question_searches_for_its_calendar() -> None:
    class Dated(Holiday):
        async def rewrite(self, question: str, org: str, history: str) -> RewriteOut:
            out = await super().rewrite(question, org, history)
            return out.model_copy(update={"lookup": "holiday calendar 2026"})

    models = Dated()
    ctx = make_ctx(models)
    _, final = await run(graph.build(InMemorySaver()), "is it holiday tom", ctx)
    assert ctx.searches == ["holiday calendar 2026"]  # type: ignore[attr-defined]
    assert final["query"] == "Is 25 November 2026 a holiday at Nimbus?"  # what is answered
    assert "relevance" not in models.calls  # the calendar's score decides


@pytest.mark.parametrize(
    ("last", "said", "want"),
    [
        ("Is 25 November 2026 a holiday?", "what about next month this date", "25 December 2026"),
        ("Is 25 December 2026 a holiday?", "and the day after that?", "26 December 2026"),
        ("Is 25 December 2026 a holiday?", "what about 26 jan", "26 January 2027"),
        ("Is 31 January 2027 a holiday?", "next month?", "28 February 2027"),
    ],
)
def test_dates_move_without_a_model(last: str, said: str, want: str) -> None:
    assert want in when.shift(last, said, date(2026, 11, 24))
    assert when.shift("How many leave days?", said) == ""


def test_resolve_and_calendar() -> None:
    now = date(2026, 11, 24)
    assert when.resolve("is it holiday tom", now) == "is it holiday 25 November 2026"
    assert when.resolve("day after tomorrow off?", now) == "26 November 2026 off?"
    assert when.resolve("is 26 january a holiday", now) == "is 26 January 2027 a holiday"
    assert when.resolve("may I carry 30 days?", now) == "may I carry 30 days?"
    assert when.calendar_for("is 26 January 2027 a holiday") == "holiday calendar 2027"
    assert when.calendar_for("Is the review due on 26 January 2027?") == ""


def test_kal_and_a_person_called_tom() -> None:
    now = date(2026, 11, 24)
    assert when.resolve("kal chutti hai kya?", now) == "25 November 2026 chutti hai kya?"
    assert when.resolve("kal chutti thi kya?", now) == "23 November 2026 chutti thi kya?"
    assert when.resolve("what is tom's role", now) == "what is tom's role"
    assert when.resolve("Is Tom on leave?", now) == "Is Tom on leave?"
