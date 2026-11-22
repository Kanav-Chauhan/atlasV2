"""Un-blind the A/B grades (run1/KEY.json) and summarize before vs after."""

import json
import statistics
import sys
from collections import Counter
from pathlib import Path

d = Path(sys.argv[1])
key = {int(k): v for k, v in json.loads((d / "KEY.json").read_text()).items()}
items = {i["id"]: i for f in sorted(d.glob("batch_*.json")) for i in json.loads(f.read_text())}
grades = {g["id"]: g for f in sorted(d.glob("grades_*.json")) for g in json.loads(f.read_text())}
assert grades.keys() == items.keys(), (len(grades), len(items))
runs = {"before": [], "after": []}
for i, g in grades.items():
    for side in "AB":
        runs[key[i][side]].append({"kind": items[i]["kind"], **g[side]})


def pct(a: int, b: int) -> str:
    return f"{a}/{b} ({100 * a / b:.1f}%)" if b else "-"


out = {}
for name, rows in runs.items():
    by = {k: [r for r in rows if r["kind"] == k] for k in ("answerable", "denied", "not_found")}
    v = {k: Counter(r["verdict"] for r in rs) for k, rs in by.items()}
    ans = by["answerable"]
    answered = [r for r in rows if r.get("faithful")]
    fa = Counter(r["faithful"] for r in answered)
    out[name] = {
        "answerable_correct": pct(v["answerable"]["correct"], len(ans)),
        "answerable_correct_or_partial": pct(v["answerable"]["correct"] + v["answerable"]["partial"], len(ans)),
        "answerable_wrong": pct(v["answerable"]["wrong"], len(ans)),
        "false_not_found": pct(v["answerable"]["false_not_found"], len(ans)),
        "denied_declined": pct(v["denied"]["declined"], len(by["denied"])),
        "denied_answered_ok": pct(v["denied"]["answered_ok"], len(by["denied"])),
        "denied_wrong": pct(v["denied"]["wrong"], len(by["denied"])),
        "leaks": sum(1 for r in rows if r.get("leak")),
        "no_answer_declined": pct(v["not_found"]["declined"], len(by["not_found"])),
        "no_answer_wrong": pct(v["not_found"]["wrong"], len(by["not_found"])),
        "faithful_yes": pct(fa["yes"], len(answered)),
        "faithful_partly": pct(fa["partly"], len(answered)),
        "faithful_no": pct(fa["no"], len(answered)),
        "verdicts": {k: dict(c) for k, c in v.items()},
    }
print(json.dumps(out, indent=1, ensure_ascii=False))
(d / "SUMMARY.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
