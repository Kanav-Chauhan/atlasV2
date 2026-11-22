"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";

type Hit = { chunk_id: string; document_id: string; title: string; page: number | null; section: string | null; text: string; score: number; rank: number };
type Stage = "vector" | "keyword" | "fused" | "reranked";
type LabResponse = {
  q: string; as_email: string;
  took_ms: { vector: number; keyword: number; fusion: number; rerank: number };
  stages: Record<Stage, Hit[]>;
};
type Metrics = { hit_at_1: number; hit_at_3: number; hit_at_5: number; mrr: number; context_recall: number; leaks: number; n: number };
export type Eval = { run_id: string; created_at: string; modes: Partial<Record<"vector" | "hybrid" | "hybrid_rerank", Metrics>> };
type Person = { name: string; title: string; email: string };

// What each stage does, in one line (docs/RAG_GUIDE.md steps 6 and 7).
const STAGES: { key: Stage; name: string; time: keyof LabResponse["took_ms"]; about: string }[] = [
  { key: "vector", name: "Vector", time: "vector", about: "Finds passages with the same meaning, by comparing embeddings (cosine)." },
  { key: "keyword", name: "Keyword", time: "keyword", about: "Finds passages that share the exact words and codes (Postgres full-text)." },
  { key: "fused", name: "Fused (RRF)", time: "fusion", about: "Merges both lists by rank: each passage scores the sum of 1 / (60 + rank)." },
  { key: "reranked", name: "Reranked", time: "rerank", about: "A cross-encoder reads the question with each top-20 passage and keeps the best 5." },
];
const MODES = [["vector", "Vector only"], ["hybrid", "Hybrid (RRF)"], ["hybrid_rerank", "Hybrid + rerank"]] as const;
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export function Lab({ people, me }: { people: Person[]; me: string }) {
  const [tab, setTab] = useState<Stage>("vector");
  const run = useMutation({ mutationFn: (body: { q: string; as_email: string }) => api<LabResponse>("/search/lab", body) });
  const data = run.data;

  // Each document gets one colour and letter, in order of first appearance across the stages.
  const docs = new Map<string, number>();
  if (data) for (const s of STAGES) for (const h of data.stages[s.key]) if (!docs.has(h.document_id)) docs.set(h.document_id, docs.size);

  return (
    <div className="lab mx-auto grid max-w-[1480px] gap-6 px-[var(--gutter)] py-10">
      <header className="grid gap-1">
        <h1 className="text-3xl font-semibold">Retrieval lab</h1>
        <p className="text-muted">One question, every stage of hybrid search side by side.</p>
      </header>

      <form className="lab-form" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const q = String(f.get("q")).trim();
        if (q) run.mutate({ q, as_email: String(f.get("as")) });
      }}>
        <label className="grid gap-1 text-sm font-medium lab-q">
          Question
          <input name="q" type="search" required className="field" placeholder="How many days of earned leave carry forward?" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Search as
          <select name="as" className="field" defaultValue={me}>
            {people.map((p) => <option key={p.email} value={p.email}>{p.name}, {p.title}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn-primary self-end" disabled={run.isPending}>{run.isPending ? "Searching" : "Run"}</button>
      </form>

      {run.error ? (
        <section className="state" role="alert">
          <h2 className="font-body text-md font-semibold">The lab run didn&apos;t finish</h2>
          <p className="text-sm text-muted">{run.error.message}</p>
        </section>
      ) : run.isPending || data ? (
        <section className="grid gap-3" aria-busy={run.isPending} aria-label="Stages">
          {data && (
            <p className="text-sm text-muted">
              Searched as {people.find((p) => p.email === data.as_email)?.name ?? data.as_email} in{" "}
              {Object.values(data.took_ms).reduce((a, b) => a + b, 0)} ms. The letter and colour follow one document across the columns.
            </p>
          )}
          <div className="tabs" role="group" aria-label="Stage">
            {STAGES.map((s) => <button key={s.key} type="button" className="chip" aria-pressed={tab === s.key} onClick={() => setTab(s.key)}>{s.name}</button>)}
          </div>
          <div className="stages">
            {STAGES.map((s) => (
              <section key={s.key} className="stage" data-active={tab === s.key} aria-labelledby={`st-${s.key}`}>
                <header className="stage-head">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 id={`st-${s.key}`} className="font-body text-md font-semibold">{s.name}</h2>
                    {data && <span className="text-xs text-muted tabular-nums">{data.took_ms[s.time]} ms</span>}
                  </div>
                  <p className="text-xs text-muted">{s.about}</p>
                </header>
                {!data ? (
                  Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton hit-skeleton" />)
                ) : data.stages[s.key].length === 0 ? (
                  <p className="text-sm text-muted">No passages at this stage.</p>
                ) : (
                  <ol className="hits">
                    {data.stages[s.key].map((h) => {
                      const d = docs.get(h.document_id) ?? 0;
                      return (
                        <li key={h.chunk_id} className="hit">
                          <div className="hit-top">
                            <span className="rank">{h.rank}</span>
                            <span className="doc" style={{ background: `var(--color-doc-${(d % 8) + 1})` }} title={h.title}>{String.fromCharCode(65 + (d % 26))}</span>
                            <span className="hit-title">{h.title}</span>
                            <span className="score">{h.score.toFixed(Math.abs(h.score) < 0.1 ? 4 : 3)}</span>
                          </div>
                          <p className="hit-text">
                            {h.page != null && <span className="text-muted">Page {h.page}. </span>}
                            {h.text.length > 160 ? `${h.text.slice(0, 160).trimEnd()}…` : h.text}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            ))}
          </div>
        </section>
      ) : (
        <section className="state">
          <h2 className="font-body text-md font-semibold">Ask a question to see each stage</h2>
          <p className="text-sm text-muted">Pick another person to check what their access lets search find.</p>
        </section>
      )}

      <LatestEval />
    </div>
  );
}

function LatestEval() {
  const { data, error, isPending } = useQuery({
    queryKey: ["evals-latest"],
    queryFn: () => api<Eval>("/evals/latest"),
    retry: (n, e) => (e as { status?: number }).status !== 404 && n < 1,
  });
  const missing = (error as { status?: number } | null)?.status === 404;

  return (
    <section className="eval grid gap-3" aria-labelledby="eval-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="eval-title" className="text-xl font-semibold">Latest evaluation</h2>
        {data && <span className="text-xs text-muted">Run {data.run_id}, {date.format(new Date(data.created_at))}</span>}
      </div>
      {isPending ? (
        <div className="skeleton" aria-busy="true" aria-label="Loading evaluation" />
      ) : missing ? (
        <p className="text-sm text-muted">No evaluation run yet.</p>
      ) : error ? (
        <p className="text-sm text-error" role="alert">{error.message}</p>
      ) : (
        <EvalTable data={data} />
      )}
    </section>
  );
}

/** Hit@k per retrieval mode for one eval run (also used by the super admin area). */
export function EvalTable({ data }: { data: Eval }) {
  const fmt = (v: number) => v.toFixed(3);
  return (
    <div className="overflow-x-auto">
      <table className="eval-table">
        <thead>
          <tr><th scope="col">Mode</th><th scope="col">Hit@1</th><th scope="col">Hit@3</th><th scope="col">Hit@5</th><th scope="col">MRR</th><th scope="col">Context recall</th><th scope="col">Leaks</th><th scope="col">Questions</th></tr>
        </thead>
        <tbody>
          {MODES.map(([key, label]) => {
            const m = data.modes[key];
            return (
              <tr key={key}>
                <th scope="row">{label}</th>
                {m ? (
                  <>
                    <td>{fmt(m.hit_at_1)}</td><td>{fmt(m.hit_at_3)}</td><td>{fmt(m.hit_at_5)}</td><td>{fmt(m.mrr)}</td><td>{fmt(m.context_recall)}</td>
                    <td className={m.leaks ? "text-error font-semibold" : undefined}>{m.leaks}</td><td>{m.n}</td>
                  </>
                ) : (
                  <td colSpan={7} className="text-muted">Not in this run</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
