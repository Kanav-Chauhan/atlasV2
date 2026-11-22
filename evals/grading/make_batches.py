"""Split a run's answers.jsonl into grading batches (compact: cited passages only)."""

import json
import sys
from pathlib import Path

src, out_dir, size = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])
out_dir.mkdir(parents=True, exist_ok=True)
rows = [json.loads(line) for line in src.read_text().splitlines() if line.strip()]
compact = []
for i, r in enumerate(rows):
    cited = r.get("cited", [])  # eval_answers.py: the passages behind [1], [2], ...
    compact.append(
        {
            "id": i,
            "kind": r["kind"],
            "doc": r.get("doc"),
            "q": r["q"],
            "reference": r.get("reference"),
            "abstained": r.get("abstained"),
            "answer": r.get("answer", "")[:2500],
            "cited": cited,
            "error": r.get("error"),
        }
    )
for b in range(0, len(compact), size):
    (out_dir / f"batch_{b // size:02d}.json").write_text(
        json.dumps(compact[b : b + size], ensure_ascii=False, indent=1)
    )
print(len(compact), "rows,", (len(compact) + size - 1) // size, "batches")
