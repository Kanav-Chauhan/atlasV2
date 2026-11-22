"""Pick the grade threshold: the top reranked score below which Atlas says "Not found".

python -m atlas_api.scripts.calibrate_grade [--org nimbus]

Positives = answerable questions whose document is in the top 5 (asked as their `as` user).
Negatives = `not_found` questions, and `restricted` questions asked as their `denied_as` user
(the right answer for them is also "not found"). The threshold that classifies the most
questions correctly wins; ties go to the lower value (answering beats a false "not found").
"""

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select

from atlas_api import retrieve
from atlas_api.access import chunk_filters
from atlas_api.db import SyncSession
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


def top_score(q: str, user: User) -> tuple[float, list[str]]:
    res = retrieve.search(q, chunk_filters(user), "hybrid_rerank")
    hits = res.final
    return (hits[0].score or 0.0) if hits else -99.0, [h.node.metadata["title"] for h in hits]


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--org", default="nimbus")
    p.add_argument("--file", default="evals/demo_v2.json")
    p.add_argument("--out", default="evals/results")
    args = p.parse_args()
    questions = json.loads(Path(args.file).read_text())["questions"]
    with SyncSession() as s:
        users = {u.email: u for u in s.scalars(select(User))}
    pos: list[float] = []
    neg: list[float] = []
    rows: list[dict[str, Any]] = []
    for q in questions:
        if rows:
            print(rows[-1]["kind"], round(rows[-1]["score"], 2), rows[-1]["q"][:60], flush=True)
        if users[q["as"]].org.slug != args.org:
            continue
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
