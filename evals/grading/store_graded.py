"""Put Claude's blind grades (run1) into the two exam runs and store their summaries in
answer_eval_runs, using eval_answers.summarize (run inside the api image)."""

import json
from pathlib import Path

from atlas_api.db import SyncSession
from atlas_api.models import AnswerEvalRun
from atlas_api.scripts.eval_answers import summarize

R = Path("/app/evals")
key = {int(k): v for k, v in json.loads((R / "grading/run1/KEY.json").read_text()).items()}
items = {i["id"]: i for n in range(8) for i in json.loads((R / f"grading/run1/batch_{n}.json").read_text())}
grades = {g["id"]: g for n in range(8) for g in json.loads((R / f"grading/run1/grades_{n}.json").read_text())}
JUDGE = {"correct": "correct", "partial": "partial", "wrong": "wrong", "declined": "refused", "answered_ok": "answered_ok"}
runs = {"before": ("20261122T163306Z", -0.98, False), "after": ("20261122T170721Z", -1.1, True)}
for name, (run_id, threshold, relevance) in runs.items():
    rows = [json.loads(x) for x in (R / f"results/{run_id}-answers.jsonl").read_text().splitlines() if x]
    by_key = {(r["q"], r["kind"], r["as"]): r for r in rows}
    for i, it in items.items():
        side = "A" if key[i]["A"] == name else "B"
        g = grades[i][side]
        r = by_key[(it["q"], it["kind"], it["asker"])]
        if g["verdict"] in JUDGE:
            r["judge"] = JUDGE[g["verdict"]]
        r["leak"] = bool(g.get("leak"))
        r["faithful"] = g.get("faithful")
    s = summarize(rows)
    answered = [r for r in rows if r.get("faithful")]
    s["faithful_yes"] = round(sum(r["faithful"] == "yes" for r in answered) / len(answered), 3)
    s["config"] = {"threshold": threshold, "relevance_grade": relevance, "judge": "claude (blind A/B)",
                   "questions": 187, "org": "all", "ragas": False,
                   "note": "relevance grade as a FILTER (first version)" if relevance else "score threshold only"}
    with SyncSession() as db:
        rid = f"{run_id}-claude"
        if not db.query(AnswerEvalRun).filter_by(run_id=rid).first():
            db.add(AnswerEvalRun(run_id=rid, summary=s))
            db.commit()
    print(name, {k: s[k] for k in ("correct_answer", "correct_or_partial", "false_not_found", "correct_not_found", "declined_in_words", "leaks", "latency_p50_ms", "latency_p95_ms", "faithful_yes")})
