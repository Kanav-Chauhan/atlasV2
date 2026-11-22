"""Blind paired grading batches: each item = one question with two Atlas answers labelled
A/B in random order (key saved separately), so the grader can't tell before from after."""

import json
import random
import sys
from pathlib import Path

before, after, out_dir, n_batches = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), int(sys.argv[4])
load = lambda p: [json.loads(line) for line in p.read_text().splitlines() if line.strip()]  # noqa: E731
key = lambda r: (r["q"], r["kind"], r["as"])  # noqa: E731
b, a = {key(r): r for r in load(before)}, {key(r): r for r in load(after)}
assert b.keys() == a.keys(), "runs must have the same questions"
rng = random.Random(20261122)


def side(r):
    return {
        "abstained": r.get("abstained"),
        "answer": (r.get("answer") or "")[:2500],
        "cited": [{"n": c["n"], "title": c["title"], "text": c["text"]} for c in r.get("cited", [])],
    }


items, answer_key = [], {}
for i, k in enumerate(sorted(b)):
    rb, ra = b[k], a[k]
    flip = rng.random() < 0.5
    first, second = (ra, rb) if flip else (rb, ra)
    answer_key[i] = {"A": "after" if flip else "before", "B": "before" if flip else "after"}
    items.append({"id": i, "kind": rb["kind"], "asker": rb["as"], "doc": rb.get("doc"), "q": rb["q"],
                  "reference": rb.get("reference"), "A": side(first), "B": side(second)})
out_dir.mkdir(parents=True, exist_ok=True)
(out_dir / "KEY.json").write_text(json.dumps(answer_key))
size = -(-len(items) // n_batches)
for j in range(n_batches):
    (out_dir / f"batch_{j}.json").write_text(json.dumps(items[j * size:(j + 1) * size], ensure_ascii=False, indent=1))
print(len(items), "pairs in", n_batches, "batches of", size)
