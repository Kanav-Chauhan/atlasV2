"""Pick the grade threshold: the top reranked score below which Atlas says "Not found".

python -m atlas_api.scripts.calibrate_grade [--org nimbus|all] [--relevance]

Positives = answerable questions whose document is in the top 5 (asked as their `as` user).
Negatives = `not_found` questions, and `restricted` questions asked as their `denied_as` user
(the right answer for them is also "not found"). The threshold that classifies the most
questions correctly wins; ties go to the lower value (answering beats a false "not found").

--relevance (Phase 6) also asks the `fast` relevance grader about each question's top 5 (the
same call the graph makes) and picks the threshold for the combined rule: a question passes
when its score >= threshold AND the grader does not say "no". It prints the whole curve so a
threshold with fewer false "not found" can be chosen over the single best accuracy.
"""

import argparse
import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select

from atlas_api import graph, retrieve
from atlas_api.access import chunk_filters
from atlas_api.db import SyncSession
from atlas_api.llm import Models
from atlas_api.models import User


def best_threshold(pos: list[float], neg: list[float]) -> tuple[float, float]:
    """(threshold, accuracy): a question passes when its top score >= threshold."""
    candidates = sorted(set(pos + neg))
    best = (candidates[0] if candidates else 0.0, -1.0)
    for i, t in enumerate(candidates):
        # Midpoint between neighbours generalises better than an observed score.
        cut = t if i == 0 else (candidates[i - 1] + t) / 2
        right = sum(p >= cut for p in pos) + sum(n < cut for n in neg)
        acc = right / max(len(pos) + len(neg), 1)
        if acc > best[1]:
            best = (cut, acc)
    return round(best[0], 3), round(best[1], 3)


def combined_curve(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """For each candidate threshold: accuracy, false "not found" (positives that would not be
    answered) and false answers (negatives that would be), with the grader's verdict applied.
    rows: {"positive": bool, "score": float, "verdict": "yes" | "partial" | "no"}."""
    scores = sorted({r["score"] for r in rows})
    cuts = [scores[0]] + [(a + b) / 2 for a, b in zip(scores, scores[1:], strict=False)]
    out = []
    for cut in cuts:
        passed = [r["score"] >= cut and r["verdict"] != "no" for r in rows]
        fnf = sum(r["positive"] and not p for r, p in zip(rows, passed, strict=True))
        fa = sum(not r["positive"] and p for r, p in zip(rows, passed, strict=True))
        out.append(
            {
                "threshold": round(cut, 3),
                "accuracy": round(1 - (fnf + fa) / max(len(rows), 1), 3),
                "false_not_found": fnf,
                "false_answer": fa,
            }
        )
    return out


def best_combined(curve: list[dict[str, Any]]) -> dict[str, Any]:
    """Highest accuracy; ties go to fewer false "not found", then the lower threshold."""
    return max(curve, key=lambda c: (c["accuracy"], -c["false_not_found"], -c["threshold"]))


def top_score(q: str, user: User) -> tuple[float, list[str]]:
    hits = top_hits(q, user)
    return (hits[0].score or 0.0) if hits else -99.0, [h.node.metadata["title"] for h in hits]


def top_hits(q: str, user: User) -> list[Any]:
    return retrieve.search(q, chunk_filters(user), "hybrid_rerank").final


def verdict(q: str, user: User) -> tuple[float, str, list[str]]:
    """Top score + the relevance grader's verdict on the top 5 (as the graph asks it)."""
    hits = top_hits(q, user)
    if not hits:
        return -99.0, "no", []
    passages = [graph.passage(h) for h in hits]
    try:
        out = asyncio.run(Models().relevance(q, q, graph.passages_text(passages), user.org.name))
        v = out.verdict
    except Exception as e:  # count a failed call as "no opinion": score alone decides
        print("grader failed:", repr(e)[:120], flush=True)
        v = "yes"
    return hits[0].score or 0.0, v, [p["title"] for p in passages]


def calibrate_relevance(
    questions: list[dict[str, Any]], users: dict[str, User], out_dir: str
) -> None:
    rows: list[dict[str, Any]] = []
    for q in questions:
        runs = []
        if q["doc"] is None:
            runs.append((False, q["as"]))
        else:
            runs.append((True, q["as"]))
            if q.get("denied_as"):
                runs.append((False, q["denied_as"]))
        for is_pos, email in runs:
            score, v, top = verdict(q["q"], users[email])
            # A retrieval miss (None): no threshold can make it right, so it is left out.
            positive = None if is_pos and q["doc"] not in top else is_pos
            row = {"q": q["q"], "as": email, "positive": positive, "score": score, "verdict": v}
            rows.append(row | {"top": top})
            print(positive, round(score, 2), v, q["q"][:60], flush=True)
    usable = [r for r in rows if r["positive"] is not None]
    curve = combined_curve(usable)
    best = best_combined(curve)
    summary = {
        "rule": "score >= threshold and verdict != no",
        "positives": sum(r["positive"] is True for r in usable),
        "negatives": sum(r["positive"] is False for r in usable),
        "retrieval_misses": len(rows) - len(usable),
        "verdicts_on_positives": {
            k: sum(r["verdict"] == k and r["positive"] for r in usable)
            for k in ("yes", "partial", "no")
        },
        "grader_no_on_negatives": sum(r["verdict"] == "no" and not r["positive"] for r in usable),
        "grader_no_on_positives": sum(r["verdict"] == "no" and r["positive"] for r in usable),
        "best": best,
    }
    print(json.dumps(summary))
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    out = Path(out_dir) / f"{run_id}-grade-relevance.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"summary": summary, "curve": curve, "questions": rows}, indent=1))
    print(f"wrote {out}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--org", default="nimbus", help="org slug, or 'all'")
    p.add_argument("--relevance", action="store_true", help="score + LLM relevance grade")
    p.add_argument("--file", default="evals/demo_v2.json")
    p.add_argument("--out", default="evals/results")
    args = p.parse_args()
    questions = json.loads(Path(args.file).read_text())["questions"]
    with SyncSession() as s:
        users = {u.email: u for u in s.scalars(select(User))}
    if args.org != "all":
        questions = [q for q in questions if users[q["as"]].org.slug == args.org]
    if args.relevance:
        calibrate_relevance(questions, users, args.out)
        return
    pos: list[float] = []
    neg: list[float] = []
    rows: list[dict[str, Any]] = []
    for q in questions:
        if rows:
            print(rows[-1]["kind"], round(rows[-1]["score"], 2), rows[-1]["q"][:60], flush=True)
        if q["doc"] is None:
            score, top = top_score(q["q"], users[q["as"]])
            neg.append(score)
            rows.append({"q": q["q"], "kind": "not_found", "score": score, "top": top})
            continue
        score, top = top_score(q["q"], users[q["as"]])
        if q["doc"] in top:
            pos.append(score)
            rows.append({"q": q["q"], "kind": "answerable", "score": score})
        if q.get("denied_as"):
            score, top = top_score(q["q"], users[q["denied_as"]])
            neg.append(score)
            rows.append({"q": q["q"], "kind": "denied", "score": score, "top": top})
    threshold, acc = best_threshold(pos, neg)
    summary = {
        "org": args.org,
        "positives": len(pos),
        "negatives": len(neg),
        "threshold": threshold,
        "accuracy": acc,
        "false_not_found": sum(s < threshold for s in pos),
        "false_answer": sum(s >= threshold for s in neg),
        "pos_min": min(pos, default=0.0),
        "neg_max": max(neg, default=0.0),
    }
    print(json.dumps(summary))
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    out = Path(args.out) / f"{run_id}-grade.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"summary": summary, "questions": rows}, indent=1))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
