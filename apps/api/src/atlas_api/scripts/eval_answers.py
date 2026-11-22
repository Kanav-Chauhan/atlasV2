"""Answer eval: evals/demo_v2.json through the real answer flow (the LangGraph graph, the
gateway models), scored with RAGAS and our own metrics.

python -m atlas_api.scripts.eval_answers [--org slug] [--limit n] [--threshold x]
    [--no-relevance] [--no-ragas] [--concurrency 2] [--judge json]

Each question runs as its `as` user; `restricted` questions also run as their `denied_as`
user, who must get "not found". Metrics (docs/RAG_GUIDE.md step 9):
- RAGAS (answered, answerable questions): faithfulness, answer relevancy, context precision
  and context recall against the reference answer; the `json` model judges through a
  LangChain wrapper, the local bge-small embeds through a LangChain Embeddings wrapper.
- correct answer: the judge compares the answer with the reference `answer` (abstaining on an
  answerable question counts as wrong); false not-found: answerable questions Atlas declined;
  correct not-found: `not_found` and denied runs that ended in "not found"; leaks: a denied run
  whose answer or passages came from the restricted document; latency p50/p95 per run.
Free-tier gateway: concurrency 2 and retries with backoff everywhere.
"""

import os

os.environ.setdefault("RAGAS_DO_NOT_TRACK", "true")  # never send usage stats anywhere

import argparse
import asyncio
import json
import logging
import math
import random
import re
import time
import uuid
import warnings
from collections import Counter
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from langchain_core.embeddings import Embeddings
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from sqlalchemy import select

from atlas_api import graph
from atlas_api.access import chunk_filters
from atlas_api.db import SyncSession
from atlas_api.llm import chat_model
from atlas_api.models import AnswerEvalRun, User
from atlas_api.settings import settings

log = logging.getLogger("eval_answers")
CITE = re.compile(r"\s*\[\d+\]")
RAGAS_METRICS = ("faithfulness", "answer_relevancy", "context_precision", "context_recall")

# ------------------------------------------------------------------ pure metric helpers


def percentile(values: list[float], p: float) -> float | None:
    """Nearest-rank percentile (p in 0..100); None for no values."""
    if not values:
        return None
    ordered = sorted(values)
    k = max(1, math.ceil(p / 100 * len(ordered)))
    return ordered[k - 1]


def rate(flags: list[bool]) -> float | None:
    return round(sum(flags) / len(flags), 3) if flags else None


def mean(values: list[float]) -> float | None:
    vals = [v for v in values if v is not None and not math.isnan(v)]
    return round(sum(vals) / len(vals), 3) if vals else None


def is_leak(row: dict[str, Any], doc: str | None) -> bool:
    """A denied run leaks when the restricted document reached the answer or its passages."""
    if row["kind"] != "denied" or not doc:
        return False
    return doc in row.get("sources", []) or doc in row.get("context_titles", [])


def answered(row: dict[str, Any]) -> bool:
    return not row.get("error") and not row["abstained"] and row.get("route") == "rag"


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """The run summary stored in answer_eval_runs (rows = one per graph run)."""
    pos = [r for r in rows if r["kind"] == "answerable" and not r.get("error")]
    neg = [r for r in rows if r["kind"] in ("not_found", "denied") and not r.get("error")]
    ms = [float(r["ms"]) for r in rows if "ms" in r and not r.get("error")]
    out: dict[str, Any] = {
        "runs": len(rows),
        "errors": sum(bool(r.get("error")) for r in rows),
        "answerable": len(pos),
        "negatives": len(neg),
        "correct_answer": rate([r.get("judge") == "correct" for r in pos]),
        "correct_or_partial": rate([r.get("judge") in ("correct", "partial") for r in pos]),
        "false_not_found": rate([not answered(r) for r in pos]),
        "correct_not_found": rate([r["abstained"] for r in neg]),
        # Answered negatives that still declined in words ("the documents don't say").
        # (judged against the reference "not found": "correct" or "refused" both mean declined)
        "declined_in_words": sum(
            r.get("judge") in ("correct", "refused") for r in neg if not r["abstained"]
        ),
        "leaks": sum(bool(r.get("leak")) for r in rows),
        "latency_p50_ms": percentile(ms, 50),
        "latency_p95_ms": percentile(ms, 95),
        "relevance": dict(Counter(str(r.get("relevance") or "") for r in rows if r.get("route"))),
    }
    scored = [r for r in pos if r.get("ragas")]
    out["ragas"] = {m: mean([r["ragas"].get(m) for r in scored]) for m in RAGAS_METRICS} | {
        "n": len(scored)
    }
    by_org: dict[str, Any] = {}
    for org in sorted({r["org"] for r in rows}):
        p = [r for r in pos if r["org"] == org]
        n = [r for r in neg if r["org"] == org]
        by_org[org] = {
            "correct_answer": rate([r.get("judge") == "correct" for r in p]),
            "false_not_found": rate([not answered(r) for r in p]),
            "correct_not_found": rate([r["abstained"] for r in n]),
            "leaks": sum(bool(r.get("leak")) for r in rows if r["org"] == org),
            "n": len(p) + len(n),
        }
    out["by_org"] = by_org
    return out


async def with_retries[T](
    make: Callable[[], Awaitable[T]], tries: int = 4, base_s: float = 4.0
) -> T:
    """Retry with exponential backoff and jitter (free-tier rate limits, flaky models)."""
    for attempt in range(tries):
        try:
            return await make()
        except Exception:
            if attempt == tries - 1:
                raise
            delay = base_s * 2**attempt + random.uniform(0, base_s)
            log.warning("retrying in %.0f s after an error", delay, exc_info=True)
            await asyncio.sleep(delay)
    raise AssertionError("unreachable")


# ------------------------------------------------------------------ the judge (correct answer)


class JudgeOut(BaseModel):
    verdict: Literal["correct", "partial", "wrong", "refused"] = Field(
        description="correct: the answer gives the reference's key facts (numbers, names, "
        "rules) without contradicting it; partial: some key facts right, some missing; "
        "wrong: contradicts the reference or answers something else; refused: it says the "
        "information is not available instead of answering"
    )
    reason: str = Field(description="one short sentence")


JUDGE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You grade answers of a company document assistant against a reference answer. "
            "Extra correct detail is fine; wording does not matter; numbers must match.",
        ),
        (
            "human",
            "Question: {question}\nReference answer: {reference}\nAssistant answer: {answer}",
        ),
    ]
)


async def judge(question: str, reference: str, answer: str, model: str) -> str:
    chain = JUDGE_PROMPT | chat_model(model, temperature=0, timeout=60).with_structured_output(
        JudgeOut, method="function_calling"
    )
    out = await with_retries(
        lambda: chain.ainvoke(
            {"question": question, "reference": reference, "answer": CITE.sub("", answer)}
        )
    )
    assert isinstance(out, JudgeOut)
    return out.verdict


# ------------------------------------------------------------------ running the graph


def runs_for(questions: list[dict[str, Any]]) -> list[tuple[dict[str, Any], str, str]]:
    """(question, kind, email): answerable/not_found as `as`, denied as `denied_as`."""
    out = []
    for q in questions:
        out.append((q, "answerable" if q["doc"] else "not_found", q["as"]))
        if q.get("denied_as"):
            out.append((q, "denied", q["denied_as"]))
    return out


async def ask(
    g: Any, q: dict[str, Any], kind: str, user: User, args: argparse.Namespace
) -> dict[str, Any]:
    ctx = graph.Ctx(
        org=user.org.name,
        filters=chunk_filters(user),
        scope=lambda _lang: "",
        threshold=args.threshold,
        relevance=not args.no_relevance,
        cache=None,  # the semantic cache would hide the flow being measured
    )
    row: dict[str, Any] = {
        "org": user.org.slug,
        "q": q["q"],
        "kind": kind,
        "as": user.email,
        "doc": q["doc"],
        "tags": q.get("tags", []),
    }
    start = time.perf_counter()

    async def once() -> Any:
        config = {"configurable": {"thread_id": f"eval:{uuid.uuid4().hex}"}}
        return await g.ainvoke(graph.new_turn(q["q"]), config=config, context=ctx)

    try:
        final = await with_retries(once)
    except Exception as e:
        log.exception("question failed: %s", q["q"][:80])
        return row | {"error": repr(e)[:300], "abstained": False}
    passages = final.get("passages") or []
    row |= {
        "ms": round((time.perf_counter() - start) * 1000),
        "route": final.get("route") or "rag",
        "abstained": bool(final.get("abstained")),
        "answer": final.get("answer", ""),
        "query": final.get("query", ""),
        "relevance": final.get("relevance", ""),
        "grade_log": final.get("grade_log", []),
        "sources": [s.get("title", "") for s in final.get("sources") or []],
        "context_titles": [p.get("title", "") for p in passages],
        "contexts": [p.get("text", "") for p in passages],
    }
    row["leak"] = is_leak(row, q["doc"])
    if answered(row) and kind == "answerable":
        row["judge"] = await judge(q["q"], q["answer"], row["answer"], args.judge)
    elif answered(row):  # an answered negative: did it at least decline in words?
        row["judge"] = await judge(q["q"], "not found", row["answer"], args.judge)
    return row


# ------------------------------------------------------------------ RAGAS


class BgeEmbeddings(Embeddings):
    """The local bge-small (LlamaIndex FastEmbed) behind LangChain's Embeddings interface."""

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        from atlas_api.ingest import embed_model

        return [list(v) for v in embed_model().get_text_embedding_batch(texts)]

    def embed_query(self, text: str) -> list[float]:
        from atlas_api.ingest import embed_model

        return list(embed_model().get_query_embedding(text))


async def add_ragas(rows: list[dict[str, Any]], model: str, concurrency: int) -> None:
    """Adds row["ragas"] = {metric: score} to answered, answerable rows."""
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    from ragas import EvaluationDataset, SingleTurnSample, aevaluate
    from ragas.dataset_schema import EvaluationResult
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.llms import LangchainLLMWrapper
    from ragas.metrics import (
        Faithfulness,
        LLMContextPrecisionWithReference,
        LLMContextRecall,
        ResponseRelevancy,
    )
    from ragas.run_config import RunConfig

    todo = [r for r in rows if r["kind"] == "answerable" and answered(r) and r["contexts"]]
    if not todo:
        return
    run_config = RunConfig(max_workers=concurrency, max_retries=6, max_wait=60, timeout=240)
    llm = LangchainLLMWrapper(
        chat_model(model, temperature=0, timeout=180), run_config=run_config, bypass_n=True
    )
    embeddings = LangchainEmbeddingsWrapper(BgeEmbeddings(), run_config=run_config)
    dataset = EvaluationDataset(
        samples=[
            SingleTurnSample(
                user_input=r["q"],
                response=CITE.sub("", r["answer"]),
                retrieved_contexts=r["contexts"],
                reference=r["reference"],
            )
            for r in todo
        ]
    )
    metrics = [
        Faithfulness(),
        ResponseRelevancy(strictness=1),
        LLMContextPrecisionWithReference(),
        LLMContextRecall(),
    ]
    result = await aevaluate(
        dataset,
        metrics=metrics,
        llm=llm,
        embeddings=embeddings,
        run_config=run_config,
        show_progress=False,
    )
    assert isinstance(result, EvaluationResult)
    names = {
        "faithfulness": "faithfulness",
        "answer_relevancy": "answer_relevancy",
        "llm_context_precision_with_reference": "context_precision",
        "context_recall": "context_recall",
    }
    for row, scores in zip(todo, result.scores, strict=True):
        row["ragas"] = {
            names[k]: (None if v is None or math.isnan(v) else round(float(v), 3))
            for k, v in scores.items()
            if k in names
        }


# ------------------------------------------------------------------ main


async def run(args: argparse.Namespace) -> None:
    questions = json.loads(Path(args.file).read_text())["questions"]
    with SyncSession() as s:  # org and departments load eagerly
        users = {u.email: u for u in s.scalars(select(User))}
    if args.org:
        questions = [q for q in questions if users[q["as"]].org.slug == args.org]
    if args.limit:
        questions = questions[: args.limit]
    g = graph.build()  # no checkpointer: every question is a fresh chat
    sem = asyncio.Semaphore(args.concurrency)
    plan = runs_for(questions)
    started = time.monotonic()
    done = 0

    async def one(q: dict[str, Any], kind: str, email: str) -> dict[str, Any]:
        nonlocal done
        async with sem:
            row = await ask(g, q, kind, users[email], args)
        row["reference"] = q["answer"]
        done += 1
        print(
            f"[{done}/{len(plan)}] {kind:10} abst={row['abstained']!s:5} "
            f"rel={row.get('relevance', '')!s:8} judge={row.get('judge', '-'):8} "
            f"{row.get('ms', '?')} ms  {q['q'][:60]}",
            flush=True,
        )
        return row

    rows = list(await asyncio.gather(*(one(q, k, e) for q, k, e in plan)))
    if not args.no_ragas:
        print("RAGAS scoring...", flush=True)
        try:
            await add_ragas(rows, args.judge, args.concurrency)
        except Exception:
            log.exception("RAGAS scoring failed; saving the other metrics")
    summary = summarize(rows) | {
        "config": {
            "threshold": args.threshold,
            "relevance_grade": not args.no_relevance,
            "judge": args.judge,
            "questions": len(questions),
            "org": args.org or "all",
            "ragas": not args.no_ragas,
        },
        "seconds": round(time.monotonic() - started),
    }
    print(json.dumps(summary, indent=1), flush=True)
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    out = Path(args.out) / f"{run_id}-answers.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    for r in rows:  # passage texts are long; titles + the answer are enough to review
        r.pop("contexts", None)
    out.write_text(json.dumps({"run_id": run_id, "summary": summary, "questions": rows}, indent=1))
    if not args.no_store:
        with SyncSession() as s:
            s.add(AnswerEvalRun(run_id=run_id, summary=summary))
            s.commit()
    print(f"wrote {out}")


def main() -> None:
    logging.basicConfig(level=logging.WARNING)
    p = argparse.ArgumentParser()
    p.add_argument("--org", help="only questions asked as users of this org (slug)")
    p.add_argument("--limit", type=int, default=0, help="first n questions only")
    p.add_argument("--threshold", type=float, default=settings.grade_threshold)
    p.add_argument("--no-relevance", action="store_true", help="score threshold only")
    p.add_argument("--no-ragas", action="store_true")
    p.add_argument("--no-store", action="store_true", help="do not save the summary in the DB")
    p.add_argument("--concurrency", type=int, default=2)
    p.add_argument("--judge", default="json", help="gateway model that judges")
    p.add_argument("--file", default="evals/demo_v2.json")
    p.add_argument("--out", default="evals/results")
    asyncio.run(run(p.parse_args()))


if __name__ == "__main__":
    main()
