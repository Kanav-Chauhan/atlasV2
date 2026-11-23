"""Phase 6: the LLM relevance grade in the graph (fake models), the answer-eval metric functions,
the grade calibration curve and the LangSmith-off default (no database, no network)."""

import os
from typing import Any

import pytest
from langgraph.checkpoint.memory import InMemorySaver
from test_chat import FakeModels, make_ctx, run, stages, text

from atlas_api import graph, llm, tracing
from atlas_api import settings as settings_module
from atlas_api.llm import RelevanceOut
from atlas_api.scripts import calibrate_grade, eval_answers

YES = RelevanceOut(verdict="yes", passages=[2])
NO = RelevanceOut(verdict="no", passages=[])

# ------------------------------------------------------------------ relevance grade wiring


async def test_grade_is_a_gate_all_passages_reach_the_answer_model() -> None:
    models = FakeModels(verdicts=[YES])
    ctx = make_ctx(models)
    events, final = await run(graph.build(InMemorySaver()), "How much earned leave?", ctx)
    assert models.calls == ["route", "relevance", "answer"]
    assert "[1] Doc 1" in models.graded[0] and "[3] Doc 3" in models.graded[0]
    # A gate, not a filter: the answer model still sees every passage (Phase 6 exam).
    seen = models.answered_with[0]
    assert seen.startswith("[1] Doc 1") and "[3] Doc 3" in seen
    assert final["relevance"] == "yes"
    assert [p["chunk_id"] for p in final["passages"]] == ["c1", "c2", "c3"]
    assert final["grade_log"][0]["verdict"] == "yes"
    assert final["abstained"] is False


async def test_grader_no_retries_once_then_not_found() -> None:
    models = FakeModels(verdicts=[NO])
    ctx = make_ctx(models)  # score is high: only the LLM says the passages don't answer
    events, final = await run(graph.build(InMemorySaver()), "What is the L4 salary band?", ctx)
    assert final["abstained"] is True
    assert text(events).startswith(graph.NOT_FOUND)
    assert "answer" not in models.calls
    assert models.calls.count("relevance") == 2
    assert models.calls.count("reformulate") == 1
    assert len(ctx.searches) == 2  # type: ignore[attr-defined]
    assert [e["verdict"] for e in final["grade_log"]] == ["no", "no"]
    assert stages(events).count("grade") == 2 and "retry" in stages(events)


async def test_grader_no_then_yes_on_the_retry_answers() -> None:
    models = FakeModels(verdicts=[NO, RelevanceOut(verdict="partial", passages=[1, 3])])
    ctx = make_ctx(models)
    _, final = await run(graph.build(InMemorySaver()), "Which leave types are there?", ctx)
    assert final["abstained"] is False
    assert final["relevance"] == "partial"
    assert [p["chunk_id"] for p in final["passages"]] == ["c1", "c2", "c3"]
    assert models.calls.count("answer") == 1


async def test_low_score_skips_the_grader() -> None:
    models = FakeModels()
    ctx = make_ctx(models, score=0.5)  # below threshold 1.0 on both attempts
    _, final = await run(graph.build(InMemorySaver()), "Can I bring my dog?", ctx)
    assert "relevance" not in models.calls
    assert final["abstained"] is True
    assert [e["verdict"] for e in final["grade_log"]] == ["skipped", "skipped"]


async def test_grader_failure_answers_on_the_score() -> None:
    class Broken(FakeModels):
        async def relevance(self, *a: Any) -> RelevanceOut:
            raise RuntimeError("gateway 500")

    models = Broken()
    _, final = await run(graph.build(InMemorySaver()), "Notice period?", make_ctx(models))
    assert final["relevance"] == "error"
    assert final["abstained"] is False and len(final["passages"]) == 3


async def test_grader_off_by_context() -> None:
    models = FakeModels(verdicts=[NO])
    ctx = make_ctx(models)
    ctx.relevance = False
    _, final = await run(graph.build(InMemorySaver()), "Notice period?", ctx)
    assert "relevance" not in models.calls
    assert final["relevance"] == "off" and final["abstained"] is False


async def test_grader_marks_out_of_range_keeps_all() -> None:
    models = FakeModels(verdicts=[RelevanceOut(verdict="yes", passages=[0, 9])])
    _, final = await run(graph.build(InMemorySaver()), "Notice period?", make_ctx(models))
    assert len(final["passages"]) == 3


async def test_visitor_grader_no_gives_contact_wording() -> None:
    models = FakeModels(verdicts=[NO])
    ctx = make_ctx(models)
    ctx.visitor, ctx.suggested = True, []
    events, final = await run(graph.build(InMemorySaver()), "Salary band for L4?", ctx)
    assert final["abstained"] and "contact Nimbus" in text(events)
    assert models.calls.count("relevance") == 2


def test_passages_show_document_date_and_superseded_flag() -> None:
    """The answer model sees each document's date (older snapshot vs current figure) and the
    SUPERSEDED flag; a passage without a date gets no empty 'dated' part."""
    text_ = graph.passages_text(
        [
            {
                "title": "Interim Report",
                "doc_no": "RPT-022",
                "section": "/5. Disposition/",
                "page": 3,
                "effective": "27 March 2026",
                "text": "87 discontinued",
            },
            {
                "title": "Site Status",
                "doc_no": None,
                "section": None,
                "page": None,
                "effective": "05 October 2026",
                "text": "92 discontinued",
            },
            {
                "title": "Old SOP",
                "doc_no": None,
                "section": "/",
                "effective": None,
                "superseded": True,
                "text": "5 days",
            },
        ]
    )
    assert (
        "[1] Interim Report (RPT-022, section /5. Disposition/, page 3, dated 27 March 2026)"
        in text_
    )
    assert "[2] Site Status (dated 05 October 2026)\n92 discontinued" in text_
    assert "[3] Old SOP [SUPERSEDED]\n5 days" in text_
    assert "dated None" not in text_


def test_passage_carries_effective_date() -> None:
    from llama_index.core.schema import NodeWithScore, TextNode

    n = TextNode(id_="c1", text="t", metadata={"title": "T", "effective": "05 October 2026"})
    assert graph.passage(NodeWithScore(node=n, score=1.0))["effective"] == "05 October 2026"
    old = TextNode(id_="c2", text="t", metadata={"title": "T"})  # chunks ingested before dates
    assert graph.passage(NodeWithScore(node=old, score=1.0))["effective"] is None


@pytest.mark.parametrize("system", [llm.ANSWER_SYSTEM, llm.VISITOR_ANSWER_SYSTEM])
def test_answer_prompts_keep_the_asked_subject(system: str) -> None:
    """Phase 6 exam: public contractual DR targets were given as the new design's targets."""
    assert "exactly what was asked" in system
    assert "related but different" in system


def test_staff_answer_prompt_prefers_the_most_recent_document() -> None:
    assert "most recent document" in llm.ANSWER_SYSTEM
    assert "SUPERSEDED" in llm.ANSWER_SYSTEM


async def test_hi_never_grades() -> None:
    models = FakeModels()
    await run(graph.build(InMemorySaver()), "Hi", make_ctx(models))
    assert models.calls == []


# ------------------------------------------------------------------ eval metric functions


def test_percentile_nearest_rank() -> None:
    assert eval_answers.percentile([], 50) is None
    assert eval_answers.percentile([5.0], 95) == 5.0
    vals = [float(v) for v in range(1, 101)]
    assert eval_answers.percentile(vals, 50) == 50.0
    assert eval_answers.percentile(vals, 95) == 95.0


def test_runs_for_adds_denied_runs() -> None:
    qs: list[dict[str, Any]] = [
        {"q": "a", "doc": "D", "as": "hr@x", "denied_as": "emp@x"},
        {"q": "b", "doc": None, "as": "emp@x"},
    ]
    assert [(k, e) for _, k, e in eval_answers.runs_for(qs)] == [
        ("answerable", "hr@x"),
        ("denied", "emp@x"),
        ("not_found", "emp@x"),
    ]


def test_is_leak_only_for_denied_runs() -> None:
    row = {"kind": "denied", "sources": [], "context_titles": ["Salary Bands"]}
    assert eval_answers.is_leak(row, "Salary Bands")
    assert not eval_answers.is_leak(row | {"context_titles": []}, "Salary Bands")
    assert not eval_answers.is_leak(row | {"kind": "answerable"}, "Salary Bands")


def _row(kind: str, org: str = "a", **kw: Any) -> dict[str, Any]:
    return {"kind": kind, "org": org, "route": "rag", "abstained": False, "ms": 100} | kw


def test_summarize() -> None:
    rows = [
        _row("answerable", judge="correct", ms=100, ragas={"faithfulness": 1.0}),
        _row("answerable", judge="partial", ms=200, ragas={"faithfulness": 0.5}),
        _row("answerable", abstained=True, ms=300),
        _row("answerable", org="b", judge="wrong", ms=400),
        _row("not_found", abstained=True, ms=50),
        _row("not_found", judge="correct", ms=70),
        _row("denied", org="b", judge="refused", leak=True, ms=60),
        _row("answerable", error="boom"),
    ]
    s = eval_answers.summarize(rows)
    assert s["runs"] == 8 and s["errors"] == 1 and s["answerable"] == 4 and s["negatives"] == 3
    assert s["correct_answer"] == 0.25
    assert s["correct_or_partial"] == 0.5
    assert s["false_not_found"] == 0.25
    assert s["correct_not_found"] == round(1 / 3, 3)
    assert s["declined_in_words"] == 2
    assert s["leaks"] == 1
    assert s["latency_p50_ms"] == 100.0 and s["latency_p95_ms"] == 400.0
    assert s["ragas"]["faithfulness"] == 0.75 and s["ragas"]["n"] == 2
    assert s["ragas"]["context_recall"] is None
    assert s["by_org"]["a"]["correct_answer"] == round(1 / 3, 3)
    assert s["by_org"]["b"]["leaks"] == 1


def test_offtopic_route_counts_as_not_answered() -> None:
    s = eval_answers.summarize([_row("answerable", route="offtopic")])
    assert s["false_not_found"] == 1.0


async def test_with_retries_backs_off_then_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps: list[float] = []

    async def fake_sleep(s: float) -> None:
        sleeps.append(s)

    monkeypatch.setattr("atlas_api.scripts.eval_answers.asyncio.sleep", fake_sleep)
    calls = 0

    async def flaky() -> str:
        nonlocal calls
        calls += 1
        if calls < 3:
            raise RuntimeError("429")
        return "ok"

    assert await eval_answers.with_retries(flaky, base_s=1) == "ok"
    assert len(sleeps) == 2 and sleeps[1] > sleeps[0] - 1


def test_combined_curve_and_best() -> None:
    rows = [
        {"positive": True, "score": 2.0, "verdict": "yes"},
        {"positive": True, "score": -1.5, "verdict": "partial"},
        {"positive": False, "score": 1.0, "verdict": "no"},  # the grader saves this one
        {"positive": False, "score": -3.0, "verdict": "yes"},
    ]
    curve = calibrate_grade.combined_curve(rows)
    best = calibrate_grade.best_combined(curve)
    assert best["accuracy"] == 1.0 and best["false_not_found"] == 0
    assert -3.0 < best["threshold"] <= -1.5


# ------------------------------------------------------------------ LangSmith


def test_langsmith_off_without_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LANGSMITH_TRACING", "true")
    monkeypatch.setenv("LANGSMITH_API_KEY", "")
    assert settings_module.langsmith_tracing() is False
    assert os.environ["LANGSMITH_TRACING"] == "false"


def test_langsmith_off_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LANGSMITH_TRACING", raising=False)
    monkeypatch.delenv("LANGSMITH_API_KEY", raising=False)
    assert settings_module.langsmith_tracing() is False
    assert settings_module.tracing is False  # the test env has no key
    assert tracing.run_config("staff", "Nimbus") == {}


def test_langsmith_on_with_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LANGSMITH_TRACING", "true")
    monkeypatch.setenv("LANGSMITH_API_KEY", "lsv2-test")
    monkeypatch.setenv("LANGSMITH_PROJECT", "")
    monkeypatch.setenv("LANGSMITH_ENDPOINT", "")
    assert settings_module.langsmith_tracing() is True
    assert os.environ["LANGSMITH_PROJECT"] == "atlas-v2"
    assert "LANGSMITH_ENDPOINT" not in os.environ
    monkeypatch.setattr(settings_module, "tracing", True)
    cfg = tracing.run_config("visitor", "Nimbus")
    assert cfg["run_name"] == "atlas-visitor" and cfg["metadata"]["org"] == "Nimbus"


async def test_trace_meta_without_run_is_empty() -> None:
    assert await tracing.trace_meta({"configurable": {}}) == {}
