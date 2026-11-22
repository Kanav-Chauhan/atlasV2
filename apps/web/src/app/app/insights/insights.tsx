"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Region } from "@/components/region";
import { api } from "@/lib/api";
import { day, type Insights } from "@/lib/types";

const n = new Intl.NumberFormat("en-IN");
const pct = (v: number | null) => (v == null ? "None yet" : `${Math.round(v)}%`);
const ms = (v: number | null) => (v == null ? "Not known" : `${n.format(Math.round(v))} ms`);
const short = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** The four plain numbers, shared by Home, Insights and the super admin company view. */
export function Stats({ d }: { d: Insights }) {
  return (
    <dl className="stats">
      <div className="stat"><dt>Questions</dt><dd>{n.format(d.questions)}</dd></div>
      <div className="stat"><dt>Answered</dt><dd>{pct(d.answered_pct)}<small>{n.format(d.answered)} questions</small></dd></div>
      <div className="stat"><dt>Not found</dt><dd>{n.format(d.not_found)}<small>Missing from your documents</small></dd></div>
      <div className="stat"><dt>Feedback</dt><dd>{n.format(d.feedback.up)} helpful<small>{n.format(d.feedback.down)} not helpful</small></dd></div>
    </dl>
  );
}

export function InsightsView({ days, scope }: { days: number; scope: string }) {
  const q = useQuery({ queryKey: ["insights", days], queryFn: () => api<Insights>(`/insights?days=${days}`) });

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-[var(--gutter)] py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold">Insights</h1>
          <p className="text-muted">What people asked in the last {days} days. {scope}</p>
        </div>
        <nav className="seg" aria-label="Period">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`/app/insights?days=${d}`} aria-current={d === days ? "page" : undefined} scroll={false}>{d} days</Link>
          ))}
        </nav>
      </header>
      <Region q={q} what="insights" rows={4} isEmpty={(d) => d.questions === 0}
        empty={<><p className="font-semibold">No questions in the last {days} days</p><p className="text-sm text-muted">Numbers appear here once people start asking.</p></>}>
        {(d) => <Full d={d} />}
      </Region>
    </div>
  );
}

function Full({ d }: { d: Insights }) {
  const maxDept = Math.max(1, ...d.by_department.map((x) => x.questions));
  return (
    <>
      <Stats d={d} />
      <section className="block" aria-labelledby="day-h">
        <div className="block-head">
          <h2 id="day-h">Questions per day</h2>
          <p className="legend"><span><i />Questions</span><span><i className="nf" />Not found</span></p>
        </div>
        <DayChart rows={d.per_day} />
      </section>

      <div className="two-col">
        <Block id="unans" title="Add these documents" note="Questions Atlas could not answer, most asked first."
          empty="Every question found an answer." items={d.top_unanswered}>
          {(x) => <li key={x.question}><span>{x.question}</span><span className="count">{x.count}×</span></li>}
        </Block>
        <Block id="req" title="Document requests" note="People asked for these after a not-found answer."
          empty="No requests yet." items={d.document_requests}>
          {(x) => (
            <li key={x.question + x.created_at}>
              <span className="grid min-w-0">
                <span>{x.question}</span>
                {x.note && <span className="text-xs text-muted">{x.note}</span>}
              </span>
              <span className="count text-right text-xs">{x.by}<br />{day.format(new Date(x.created_at))}</span>
            </li>
          )}
        </Block>
        <Block id="docs" title="Most cited documents" note="Sources used most in answers."
          empty="No answers cited a document yet." items={d.top_documents}>
          {(x) => (
            <li key={x.document_id}>
              <a href={`/api/documents/${x.document_id}/file`} target="_blank" rel="noreferrer">{x.title}</a>
              <span className="count">{x.citations === 1 ? "1 citation" : `${n.format(x.citations)} citations`}</span>
            </li>
          )}
        </Block>
        <Block id="dept" title="By department" note="Questions asked by people in each department."
          empty="No department data yet." items={d.by_department}>
          {(x) => (
            <li key={x.department} className="stack">
              <span className="flex justify-between gap-2"><span>{x.department}</span><span className="count">{n.format(x.questions)}</span></span>
              <span className="hbar" style={{ width: `${(x.questions / maxDept) * 100}%` }} aria-hidden="true" />
            </li>
          )}
        </Block>
      </div>

      <details className="tech">
        <summary>Show technical details</summary>
        <dl className="stats mt-3">
          <div className="stat"><dt>Average answer time</dt><dd>{ms(d.avg_latency_ms)}</dd></div>
          <div className="stat"><dt>Slowest 5% (p95)</dt><dd>{ms(d.p95_latency_ms)}</dd></div>
          <div className="stat"><dt>Blocked</dt><dd>{n.format(d.blocked)}<small>Unsafe or off-limits requests</small></dd></div>
          <div className="stat"><dt>Small talk</dt><dd>{n.format(d.smalltalk)}<small>Greetings and chit-chat</small></dd></div>
        </dl>
      </details>
    </>
  );
}

function Block<T>({ id, title, note, empty, items, children }: {
  id: string; title: string; note: string; empty: string; items: T[]; children: (x: T) => React.ReactNode;
}) {
  return (
    <section className="block" aria-labelledby={`${id}-h`}>
      <div className="block-head"><div><h2 id={`${id}-h`}>{title}</h2><p>{note}</p></div></div>
      {items.length ? <ul className="list">{items.map(children)}</ul> : <div className="state"><p className="text-sm text-muted">{empty}</p></div>}
    </section>
  );
}

// Bars: full height = questions that day, the warn part at the bottom = not found. A hidden table carries the same numbers.
function DayChart({ rows }: { rows: Insights["per_day"] }) {
  const max = Math.max(1, ...rows.map((r) => r.questions));
  const w = 10;
  return (
    <figure className="grid gap-1">
      <div className="flex justify-between text-xs text-muted"><span>Most in a day: {n.format(max)}</span></div>
      <svg className="chart" viewBox={`0 0 ${rows.length * w} 100`} preserveAspectRatio="none" aria-hidden="true">
        {rows.map((r, i) => {
          const h = (r.questions / max) * 100;
          const nf = (r.not_found / max) * 100;
          return (
            <g key={r.date}>
              <rect className="q" x={i * w + 1.5} y={100 - h} width={w - 3} height={h} />
              <rect className="nf" x={i * w + 1.5} y={100 - nf} width={w - 3} height={nf} />
            </g>
          );
        })}
      </svg>
      {rows.length > 0 && (
        <figcaption className="flex justify-between text-xs text-muted">
          <span>{short.format(new Date(rows[0].date))}</span><span>{short.format(new Date(rows[rows.length - 1].date))}</span>
        </figcaption>
      )}
      {/* A table can't shrink below its rows, so the sr-only box is a div around it. */}
      <div className="sr-only"><table>
        <caption>Questions and not-found answers per day</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Questions</th><th scope="col">Not found</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.date}><th scope="row">{r.date}</th><td>{r.questions}</td><td>{r.not_found}</td></tr>)}</tbody>
      </table></div>
    </figure>
  );
}
