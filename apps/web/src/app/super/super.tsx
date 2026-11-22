"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { EvalTable, type Eval } from "@/app/app/lab/lab";
import { Region } from "@/components/region";
import { api } from "@/lib/api";
import { day } from "@/lib/types";

type OrgRow = { slug: string; name: string; people: number; documents: number; chunks: number; questions_30d: number; not_found_pct_30d: number | null; last_activity: string | null };
type Usage = { org: string; model: string; questions: number; tokens_in: number | null; tokens_out: number | null; avg_latency_ms: number | null };
type Waiter = { email: string; created_at?: string };
type Rate = number | null;
type AnswerSummary = {
  runs: number; errors: number; answerable: number; negatives: number;
  correct_answer: Rate; correct_or_partial: Rate; false_not_found: Rate; correct_not_found: Rate; leaks: number;
  latency_p50_ms: number | null; latency_p95_ms: number | null;
  ragas: { faithfulness: Rate; answer_relevancy: Rate; context_precision: Rate; context_recall: Rate; n: number };
  by_org: Record<string, { correct_answer: Rate; false_not_found: Rate; correct_not_found: Rate; leaks: number; n: number }>;
  config?: { threshold: number; relevance_grade: boolean; questions: number; org: string };
};
type Run = (Eval & { kind?: "retrieval" }) | { kind: "answers"; run_id: string; created_at: string; summary: AnswerSummary };

const n = new Intl.NumberFormat("en-IN");
const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const known = (v: number | null) => (v == null ? <span className="text-muted">Not known</span> : n.format(v));

export function SuperHome() {
  const orgs = useQuery({ queryKey: ["super-orgs"], queryFn: () => api<OrgRow[]>("/super/orgs") });
  const evals = useQuery({ queryKey: ["super-evals"], queryFn: () => api<Run[]>("/super/evals") });
  const usage = useQuery({ queryKey: ["super-usage"], queryFn: () => api<Usage[]>("/super/usage?days=30") });
  const waitlist = useQuery({ queryKey: ["super-waitlist"], queryFn: () => api<Waiter[]>("/super/waitlist") });

  return (
    <>
      <header className="grid gap-1">
        <h1 className="text-3xl font-semibold">Every company</h1>
        <p className="text-muted">Companies, retrieval quality and model usage across Atlas.</p>
      </header>

      <section id="companies" className="block" aria-labelledby="co-h">
        <div className="block-head"><h2 id="co-h">Companies</h2></div>
        <Region q={orgs} what="company list" rows={3}
          empty={<><p className="font-semibold">No companies yet</p><p className="text-sm text-muted">Companies appear here once they sign up.</p></>}>
          {(d) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th scope="col">Company</th><th scope="col" className="num">People</th><th scope="col" className="num">Documents</th><th scope="col" className="num hide-sm">Chunks</th><th scope="col" className="num">Questions, 30 days</th><th scope="col" className="num">Not found</th><th scope="col" className="hide-sm">Last activity</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
                <tbody>
                  {d.map((o) => (
                    <tr key={o.slug}>
                      <th scope="row"><span className="block font-semibold">{o.name}</span><span className="text-xs font-normal text-muted">{o.slug}</span></th>
                      <td className="num">{n.format(o.people)}</td><td className="num">{n.format(o.documents)}</td><td className="num hide-sm">{n.format(o.chunks)}</td>
                      <td className="num">{n.format(o.questions_30d)}</td><td className="num">{o.not_found_pct_30d == null ? <span className="text-muted">None yet</span> : `${Math.round(o.not_found_pct_30d)}%`}</td>
                      <td className="hide-sm text-muted">{o.last_activity ? day.format(new Date(o.last_activity)) : "None yet"}</td>
                      <td><Link className="btn" href={`/super/orgs/${o.slug}`}>View<span className="sr-only"> {o.name}</span></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Region>
      </section>

      <section id="evals" className="block" aria-labelledby="ev-h">
        <div className="block-head"><div><h2 id="ev-h">Evaluations</h2><p>Retrieval and answer eval runs, newest first.</p></div><Link className="link" href="/app/lab">Retrieval lab</Link></div>
        <Region q={evals} what="evaluations" rows={2}
          empty={<><p className="font-semibold">No evaluation runs yet</p><p className="text-sm text-muted">Runs appear here after the retrieval or answer eval script finishes.</p></>}>
          {(d) => (
            <div className="grid gap-6">
              {d.map((r) => (
                <div key={r.run_id} className="eval grid gap-2">
                  <h3 className="font-body text-sm font-semibold">{r.kind === "answers" ? "Answers" : "Retrieval"} · run {r.run_id}<span className="font-normal text-muted">, {when.format(new Date(r.created_at))}</span></h3>
                  {r.kind === "answers" ? <AnswerTable s={r.summary} /> : <EvalTable data={r} />}
                </div>
              ))}
            </div>
          )}
        </Region>
      </section>

      <section id="usage" className="block" aria-labelledby="us-h">
        <div className="block-head"><div><h2 id="us-h">Usage</h2><p>Last 30 days, per company and model.</p></div></div>
        <Region q={usage} what="usage" rows={3}
          empty={<p className="text-sm text-muted">No model calls in the last 30 days.</p>}>
          {(d) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th scope="col">Company</th><th scope="col">Model</th><th scope="col" className="num">Questions</th><th scope="col" className="num">Tokens in</th><th scope="col" className="num">Tokens out</th><th scope="col" className="num">Avg time</th></tr></thead>
                <tbody>
                  {d.map((u) => (
                    <tr key={u.org + u.model}>
                      <th scope="row">{u.org}</th><td className="font-mono text-xs">{u.model}</td><td className="num">{n.format(u.questions)}</td>
                      <td className="num">{known(u.tokens_in)}</td><td className="num">{known(u.tokens_out)}</td>
                      <td className="num">{u.avg_latency_ms == null ? <span className="text-muted">Not known</span> : `${n.format(Math.round(u.avg_latency_ms))} ms`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Region>
      </section>

      <section id="waitlist" className="block" aria-labelledby="wl-h">
        <div className="block-head"><h2 id="wl-h">Waitlist</h2></div>
        <Region q={waitlist} what="waitlist" rows={1}
          empty={<><p className="font-semibold">Opens with Clerk in Phase 10</p><p className="text-sm text-muted">Emails from &quot;Join the waitlist&quot; will be listed here.</p></>}>
          {(d) => (
            <ul className="list">
              {d.map((w) => <li key={w.email}><span>{w.email}</span>{w.created_at && <span className="count">{day.format(new Date(w.created_at))}</span>}</li>)}
            </ul>
          )}
        </Region>
      </section>
    </>
  );
}

const pct = (v: Rate) => (v == null ? <span className="text-muted">None</span> : `${Math.round(v * 1000) / 10}%`);
const score = (v: Rate) => (v == null ? <span className="text-muted">None</span> : v.toFixed(3));
const secs = (ms: number | null) => (ms == null ? "None" : `${(ms / 1000).toFixed(1)} s`);

/** One answer eval run (scripts/eval_answers.py): our own metrics per company, then RAGAS. */
function AnswerTable({ s }: { s: AnswerSummary }) {
  const rows: [string, { correct_answer: Rate; false_not_found: Rate; correct_not_found: Rate; leaks: number; n: number }][] = [
    ["All companies", { ...s, n: s.answerable + s.negatives }],
    ...Object.entries(s.by_org ?? {}),
  ];
  return (
    <div className="grid gap-3">
      {s.config && (
        <p className="text-xs text-muted">
          Grade threshold {s.config.threshold}, LLM relevance grade {s.config.relevance_grade ? "on" : "off"}, {s.config.questions} questions
          {s.errors ? `, ${s.errors} failed runs` : ""}. Time per answer: p50 {secs(s.latency_p50_ms)}, p95 {secs(s.latency_p95_ms)}.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="eval-table">
          <thead>
            <tr><th scope="col">Company</th><th scope="col">Correct answers</th><th scope="col">False “not found”</th><th scope="col">Correct “not found”</th><th scope="col">Leaks</th><th scope="col">Runs</th></tr>
          </thead>
          <tbody>
            {rows.map(([name, m]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{pct(m.correct_answer)}</td><td>{pct(m.false_not_found)}</td><td>{pct(m.correct_not_found)}</td>
                <td className={m.leaks ? "text-error font-semibold" : undefined}>{m.leaks}</td><td>{m.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="eval-table">
          <thead>
            <tr><th scope="col">RAGAS</th><th scope="col">Faithfulness</th><th scope="col">Answer relevancy</th><th scope="col">Context precision</th><th scope="col">Context recall</th><th scope="col">Answers scored</th></tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Mean</th>
              <td>{score(s.ragas?.faithfulness ?? null)}</td><td>{score(s.ragas?.answer_relevancy ?? null)}</td>
              <td>{score(s.ragas?.context_precision ?? null)}</td><td>{score(s.ragas?.context_recall ?? null)}</td><td>{s.ragas?.n ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
