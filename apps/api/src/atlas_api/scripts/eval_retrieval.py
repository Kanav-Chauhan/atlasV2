"""Retrieval eval on evals/demo_v2.json against the live database.

python -m atlas_api.scripts.eval_retrieval [--modes vector,keyword,hybrid,hybrid_rerank]
    [--org slug]   (default: all four modes, all companies; prints per-company numbers too)

Each question runs as its `as` user. Hit@k = the expected document's title is in the top k,
MRR = 1/rank of its first chunk, context recall = the evidence text is in the top-5 chunks.
`denied_as` questions also run as that user: a LEAK is the document in ANY stage's list.
"""

import argparse
import html
import json
import re
import time
import unicodedata
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select

from atlas_api import retrieve
from atlas_api.access import chunk_filters
from atlas_api.db import SyncSession
from atlas_api.models import EvalRun, User


def norm(s: str) -> str:
    """Compare text ignoring case, ligatures, HTML entities, dashes, markdown and whitespace."""
    s = unicodedata.normalize("NFKC", html.unescape(s)).casefold()
    s = re.sub(r"[‐-―−]", "-", s)
    s = re.sub(r"[*_`#|>]", " ", s)
    s = re.sub(r"\s*-\s*", "-", s)  # PDF text puts stray spaces around dashes: "91.2- 106.1"
    return " ".join(s.split())


def score(hits: list[str], texts: list[str], q: dict[str, Any]) -> dict[str, float]:
    """hits = document titles in rank order (one per chunk); texts = the chunk texts."""
    rank = next((i for i, t in enumerate(hits, 1) if t == q["doc"]), None)
    return {
        "hit_at_1": float(rank is not None and rank <= 1),
        "hit_at_3": float(rank is not None and rank <= 3),
        "hit_at_5": float(rank is not None and rank <= 5),
        "mrr": 1 / rank if rank else 0.0,
        "context_recall": float(norm(q["evidence"]) in norm(" ".join(texts[:5]))),
    }


def mean(rows: list[dict[str, float]]) -> dict[str, float]:
    return {k: round(sum(r[k] for r in rows) / len(rows), 3) for k in rows[0]} if rows else {}


def run(
    questions: list[dict[str, Any]], modes: list[str], users: dict[str, User]
) -> tuple[dict[str, Any], list[Any]]:
    summary: dict[str, Any] = {}
    detail: list[dict[str, Any]] = []
    for mode in modes:
        scored: dict[str, list[dict[str, float]]] = {}  # org slug -> per-question metrics
        leaks = 0
        start = time.monotonic()
        for q in questions:
            org = users[q["as"]].org.slug
            row: dict[str, Any] = {"mode": mode, "org": org, "q": q["q"], "doc": q["doc"]}
            if q["doc"] is not None:  # not_found questions have no document to hit
                t = time.perf_counter()
                res = retrieve.search(q["q"], chunk_filters(users[q["as"]]), mode)
                row["ms"] = round((time.perf_counter() - t) * 1000)
                top = res.final[: retrieve.FINAL_K]
                titles = [h.node.metadata.get("title", "") for h in top]
                m = score(titles, [h.node.get_content() for h in top], q)
                scored.setdefault(org, []).append(m)
                row |= m | {"top": titles}
            if q.get("denied_as"):
                res = retrieve.search(q["q"], chunk_filters(users[q["denied_as"]]), mode)
                seen = {h.node.metadata.get("title") for hs in res.stages.values() for h in hs}
                row["leak"] = q["doc"] in seen
                leaks += row["leak"]
            detail.append(row)
        everything = [m for rows in scored.values() for m in rows]
        ms = sorted(r["ms"] for r in detail if r["mode"] == mode and "ms" in r)
        summary[mode] = mean(everything) | {
            "leaks": leaks,
            "n": len(everything),
            "seconds": round(time.monotonic() - start),
            "p50_ms": ms[len(ms) // 2] if ms else 0,
            "by_org": {org: mean(rows) | {"n": len(rows)} for org, rows in sorted(scored.items())},
        }
        print(mode, json.dumps(summary[mode]), flush=True)
    return summary, detail


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--modes", default=",".join(retrieve.MODES))
    p.add_argument("--org", help="only questions asked as users of this org (slug)")
    p.add_argument("--file", default="evals/demo_v2.json")
    p.add_argument("--out", default="evals/results")
    args = p.parse_args()
    modes = args.modes.split(",")
    if bad := set(modes) - set(retrieve.MODES):
        raise SystemExit(f"Unknown mode(s): {', '.join(bad)}. Use {', '.join(retrieve.MODES)}.")
    questions = json.loads(Path(args.file).read_text())["questions"]
    with SyncSession() as s:  # org and departments load eagerly
        users = {u.email: u for u in s.scalars(select(User))}
    if args.org:
        questions = [q for q in questions if users[q["as"]].org.slug == args.org]
    summary, detail = run(questions, modes, users)
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    out = Path(args.out) / f"{run_id}-retrieval.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps({"run_id": run_id, "summary": summary, "questions": detail}, indent=1)
    )
    with SyncSession() as s:
        s.add(EvalRun(run_id=run_id, modes=summary))
        s.commit()
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
