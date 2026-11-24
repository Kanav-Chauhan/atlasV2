"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Region } from "@/components/region";
import { ChartContainer, ChartLegend, ChartTooltip, ChartTooltipContent, useReducedMotion, type ChartConfig } from "@/components/ui/chart";
import { Icon } from "@/components/ui/icons";
import { Card, Page, PageHeader } from "@/components/ui/page";
import { api } from "@/lib/api";
import { day, type Insights } from "@/lib/types";
import "./insights.css";

// Chart forms follow the dataviz skill: KPI row of stat tiles (value + change + small trend), stacked columns for
// questions over time (answered / not found / other), a tall segmented bar for how questions ended (not a donut),
// ranked horizontal bars for departments, a bar list for documents. Colours: components/ui/chart.css.

const n = new Intl.NumberFormat("en-IN");
const pct = (v: number | null) => (v == null ? "None yet" : `${Math.round(v)}%`);
const ms = (v: number | null) => (v == null ? "Not known" : `${n.format(Math.round(v))} ms`);
// per_day dates are UTC calendar days: format them in UTC so a day never shifts.
const dShort = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const dWeekday = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" });
const dLong = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const plural = (k: number, one: string, many = `${one}s`) => `${n.format(k)} ${k === 1 ? one : many}`;

/** The four plain numbers, shared by the super admin company view. */
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
  const q = useQuery({
    queryKey: ["insights", days],
    queryFn: () => api<Insights>(`/insights?days=${days}`),
    placeholderData: keepPreviousData, // a period switch keeps the old charts (dimmed) until the new numbers arrive
  });

  return (
    <Page className="ins viz">
      <PageHeader title="Insights" description={<>What people asked in the last {days} days. {scope}</>}
        actions={
          <nav className="seg" aria-label="Period">
            {[7, 30, 90].map((d) => (
              <Link key={d} href={`/app/insights?days=${d}`} aria-current={d === days ? "page" : undefined} scroll={false}>{d} days</Link>
            ))}
          </nav>
        } />
      <Region q={q} what="insights" rows={4} isEmpty={() => false} empty={null}>
        {(d) => (
          <div className="ins-body" data-stale={q.isPlaceholderData || undefined} aria-busy={q.isFetching || undefined}>
            {d.questions === 0 ? <Empty d={d} days={days} /> : <Full d={d} days={days} />}
          </div>
        )}
      </Region>
    </Page>
  );
}

// ───────────────────────────────────────────────────────────── empty

function Empty({ d, days }: { d: Insights; days: number }) {
  const before = d.previous.questions;
  return (
    <section className="card ins-empty" aria-labelledby="ins-empty-h">
      <span className="ins-empty-icon"><Icon name="insights" className="size-6" /></span>
      <h2 id="ins-empty-h">{before ? `No questions in the last ${days} days` : "No questions yet"}</h2>
      {before ? (
        <>
          <p>There were {plural(before, "question")} in the {days} days before. Look at a longer period:</p>
          <div className="ins-empty-actions">
            {[30, 90].filter((x) => x > days).map((x) => <Link key={x} className="btn" href={`/app/insights?days=${x}`} scroll={false}>Last {x} days</Link>)}
          </div>
        </>
      ) : (
        <>
          <p>Charts fill in as people ask Atlas questions: how many were answered, which documents helped, and which documents are missing.</p>
          <div className="ins-empty-actions">
            <Link className="btn btn-primary" href="/app/ask"><Icon name="ask" className="size-4" />Ask a question</Link>
            <Link className="btn" href="/app/library"><Icon name="upload" className="size-4" />Add documents</Link>
          </div>
        </>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────── full page

function Full({ d, days }: { d: Insights; days: number }) {
  const series = bins(d.per_day, days);
  return (
    <>
      {!!d.sample && <p className="text-sm text-muted" role="note">Demo data: {n.format(d.sample)} of these {n.format(d.questions)} questions are samples, added so the charts have something to show.</p>}
      <Kpis d={d} days={days} series={series} />
      <OverTime series={series} days={days} total={d.questions} />
      {/* Two stacks rather than rows, so a short card never leaves a hole beside a tall one.
          Left: what to act on; right: what is being used. One column on small screens, in this order. */}
      <div className="ins-grid">
        <div className="ins-col">
          <Outcome d={d} />
          <Unanswered rows={d.top_unanswered} />
          <Requests rows={d.document_requests} />
        </div>
        <div className="ins-col">
          <Departments rows={d.by_department} />
          <TopDocuments rows={d.top_documents} />
          <Speed d={d} />
        </div>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────── time bins

type Bin = { key: string; tick: string; range: string; answered: number; notFound: number; other: number; total: number };

/** 7 and 30 days: one column per day. 90 days: one per week (ending today), so the chart stays readable. */
function bins(rows: Insights["per_day"], days: number): Bin[] {
  const size = days > 31 ? 7 : 1;
  const out: Bin[] = [];
  for (let end = rows.length; end > 0; end -= size) {
    const chunk = rows.slice(Math.max(0, end - size), end);
    const first = utc(chunk[0].date), last = utc(chunk[chunk.length - 1].date);
    const sum = (f: (r: Insights["per_day"][number]) => number) => chunk.reduce((a, r) => a + f(r), 0);
    const total = sum((r) => r.questions), answered = sum((r) => r.answered), notFound = sum((r) => r.not_found);
    out.push({
      key: chunk[0].date,
      tick: size > 1 ? dShort.format(first) : days <= 7 ? dWeekday.format(first) : dShort.format(first),
      range: size > 1 ? `${dShort.format(first)} – ${dShort.format(last)}` : dLong.format(first),
      answered, notFound, other: Math.max(0, total - answered - notFound), total,
    });
  }
  return out.reverse();
}

// ───────────────────────────────────────────────────────────── KPI tiles

function Kpis({ d, days, series }: { d: Insights; days: number; series: Bin[] }) {
  const p = d.previous;
  const rated = d.feedback.up + d.feedback.down;
  const vs = `vs previous ${days} days`;
  return (
    <ul className="ins-kpis" aria-label="Key numbers">
      <Kpi icon="ask" label="Questions" value={n.format(d.questions)}
        delta={change(d.questions, p.questions, null, vs)}
        foot={<Spark series={series} pick={(b) => b.total} label="Questions" />} />
      <Kpi icon="check" label="Answered" value={pct(d.answered_pct)}
        delta={d.answered_pct != null && p.answered_pct != null ? change(d.answered_pct, p.answered_pct, true, vs, "pts") : undefined}
        sub={`${plural(d.answered, "document question")} answered`}
        foot={d.answered_pct != null ? <span className="ins-meter" aria-hidden="true"><i style={{ width: `${d.answered_pct}%` }} /></span> : undefined} />
      <Kpi icon="fileQuestion" label="Not found" value={n.format(d.not_found)}
        delta={change(d.not_found, p.not_found, false, vs)}
        sub="Missing from your documents"
        foot={<Spark series={series} pick={(b) => b.notFound} label="Not found" />} />
      <Kpi icon="thumb" label="Helpful" value={n.format(d.feedback.up)}
        delta={change(d.feedback.up, p.helpful, true, vs)}
        sub={rated ? `${plural(d.feedback.down, "answer")} marked not helpful` : "No ratings yet"}
        foot={rated ? (
          <span className="ins-split" aria-hidden="true">
            {d.feedback.up > 0 && <i style={{ flexGrow: d.feedback.up, background: "var(--series-1)" }} />}
            {d.feedback.down > 0 && <i style={{ flexGrow: d.feedback.down, background: "var(--series-2)" }} />}
          </span>
        ) : undefined} />
    </ul>
  );
}

type Delta = { text: string; tone: "up-good" | "up-bad" | "neutral"; dir: "up" | "down" | "flat" };

/** Change vs the previous period; colour = direction × whether up is good (null = neither). */
function change(now: number, before: number, upIsGood: boolean | null, vs: string, unit?: "pts"): Delta {
  const diff = Math.round((now - before) * 10) / 10;
  if (diff === 0) return { text: `Same as previous period`, tone: "neutral", dir: "flat" };
  const dir = diff > 0 ? "up" : "down";
  const good = upIsGood == null ? null : (diff > 0) === upIsGood;
  const size = unit === "pts" ? `${Math.abs(diff)} pts` : n.format(Math.abs(diff));
  return { text: `${diff > 0 ? "+" : "−"}${size} ${vs}`, tone: good == null ? "neutral" : good ? "up-good" : "up-bad", dir };
}

function Kpi({ icon, label, value, sub, delta, foot }: {
  icon: "ask" | "check" | "fileQuestion" | "thumb"; label: string; value: string; sub?: string; delta?: Delta; foot?: React.ReactNode;
}) {
  return (
    <li className="ins-kpi">
      <p className="ins-kpi-label">
        <span className="ins-kpi-icon">{icon === "thumb" ? <ThumbIcon /> : <Icon name={icon} className="size-4" />}</span>{label}
      </p>
      <p className="ins-kpi-value">{value}</p>
      {delta && (
        <p className="ins-delta" data-tone={delta.tone}>
          {delta.dir !== "flat" && <svg viewBox="0 0 10 10" aria-hidden="true"><path d={delta.dir === "up" ? "M5 2l4 6H1z" : "M5 8L1 2h8z"} /></svg>}
          {delta.text}
        </p>
      )}
      {sub && <p className="ins-kpi-sub">{sub}</p>}
      {foot && <div className="ins-kpi-foot">{foot}</div>}
    </li>
  );
}

function ThumbIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
      <path d="M7 10v11H3V10zM7 10l4-7a2 2 0 0 1 3 2l-1 5h6a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 17.6 21H7" />
    </svg>
  );
}

/** Small trend: history in the quiet grey, the latest column in the accent. Decoration only (numbers are in the chart). */
function Spark({ series, pick, label }: { series: Bin[]; pick: (b: Bin) => number; label: string }) {
  const data = series.map((b) => ({ k: b.key, v: pick(b) }));
  if (!data.some((x) => x.v > 0)) return null;
  return (
    <div className="ins-spark" aria-hidden="true">
      <ChartContainer config={{ v: { label, color: "var(--series-quiet)" } }} label={`${label} trend`} tabIndex={-1}>
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={1} accessibilityLayer={false}>
          <Bar dataKey="v" isAnimationActive={false} radius={[2, 2, 0, 0]} minPointSize={1} maxBarSize={8}>
            {data.map((x, i) => <Cell key={x.k} fill={i === data.length - 1 ? "var(--series-1)" : x.v ? "var(--series-quiet)" : "var(--color-rule-soft)"} />)}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── questions over time

const timeConfig = {
  answered: { label: "Answered", color: "var(--series-1)" },
  notFound: { label: "Not found", color: "var(--series-2)" },
  other: { label: "Small talk or blocked", color: "var(--series-quiet)" },
} satisfies ChartConfig;
const STACK = ["answered", "notFound", "other"] as const;
type StackKey = (typeof STACK)[number];

function OverTime({ series, days, total }: { series: Bin[]; days: number; total: number }) {
  const still = useReducedMotion();
  const weekly = days > 31;
  const unit = weekly ? "week" : "day";
  const active = series.filter((b) => b.total > 0);
  const busiest = active.reduce<Bin | null>((m, b) => (!m || b.total > m.total ? b : m), null);
  const hasOther = series.some((b) => b.other > 0);
  const keys = STACK.filter((k) => k !== "other" || hasOther);
  const narrow = useNarrow();
  // Ticks: every column for 7 days; otherwise every 7th day / 2nd week, counted back from today so today is labelled.
  // Phones get half as many so labels never touch.
  const step = (days <= 7 ? 1 : weekly ? 2 : 7) * (narrow && days !== 30 ? 2 : 1);
  const ticks = series.filter((_, i) => (series.length - 1 - i) % step === 0).map((b) => b.key);
  const tickOf = new Map(series.map((b) => [b.key, b.tick]));
  const summary = busiest
    ? `${plural(total, "question")} in the last ${days} days, on ${plural(active.length, `active ${unit}`)} out of ${series.length}. Busiest ${unit}: ${busiest.range}, ${plural(busiest.total, "question")}.`
    : "";

  return (
    <Card id="ins-time" title="Questions over time" className="ins-time"
      note={busiest ? <>Busiest {unit}: <strong className="text-ink">{busiest.range}</strong> · {plural(busiest.total, "question")} · active on {active.length} of {series.length} {unit}s</> : undefined}
      action={<ChartLegend config={timeConfig} keys={keys} />}>
      <ChartContainer config={timeConfig} label={`Questions per ${unit}, answered, not found${hasOther ? " and other" : ""}`} description={summary}
        className="ins-time-chart">
        <BarChart data={series} margin={{ top: 20, right: 4, bottom: 0, left: -12 }} barCategoryGap={days <= 7 ? "30%" : "18%"} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="key" ticks={ticks} tickFormatter={(k: string) => tickOf.get(k) ?? ""} tickLine={false}
            axisLine={{ stroke: "var(--color-rule)" }} tickMargin={8} interval={0} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} tickCount={4} tickMargin={6}
            tickFormatter={(v: number) => n.format(v)} />
          <ChartTooltip cursor={{ fill: "var(--color-paper-2)", stroke: "none", radius: 6 }} isAnimationActive={false}
            content={<ChartTooltipContent hideZero valueFormatter={(v) => n.format(v)}
              labelFormatter={(_, row) => (row as Bin).range}
              footer={(row) => `${plural((row as Bin).total, "question")} in total`} />} />
          {keys.map((k) => (
            <Bar key={k} dataKey={k} stackId="q" fill={`var(--chart-${k})`} maxBarSize={24} isAnimationActive={!still}
              animationDuration={500} shape={(p: unknown) => <Segment p={p} k={k} mark={busiest?.key} />} />
          ))}
        </BarChart>
      </ChartContainer>
      <details className="ins-table">
        <summary>Show the numbers as a table</summary>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th scope="col">{weekly ? "Week" : "Day"}</th><th scope="col" className="num">Answered</th><th scope="col" className="num">Not found</th><th scope="col" className="num">Other</th><th scope="col" className="num">Total</th></tr></thead>
            <tbody>
              {[...series].reverse().map((b) => (
                <tr key={b.key}><th scope="row">{b.range}</th><td className="num">{b.answered}</td><td className="num">{b.notFound}</td><td className="num">{b.other}</td><td className="num">{b.total}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

/** One stacked segment: 2px surface gap below it when something sits under it, 4px rounded top only on the top segment.
 *  A day with no questions gets a 2px stub on the baseline (so quiet days read as "0", not as missing);
 *  the busiest column carries its total above it (the one direct label). */
function Segment({ p, k, mark }: { p: unknown; k: StackKey; mark?: string }) {
  const { x, y, width, height, payload, fill } = p as { x: number; y: number; width: number; height: number; payload: Bin; fill: string };
  if (payload.total === 0 && k === "answered") return <rect x={x} y={y + height - 2} width={width} height={2} rx={1} fill="var(--viz-grid)" />;
  if (!(height > 0)) return null;
  const idx = STACK.indexOf(k);
  const below = STACK.slice(0, idx).some((s) => payload[s] > 0);
  const top = !STACK.slice(idx + 1).some((s) => payload[s] > 0);
  const h = Math.max(1, height - (below ? 2 : 0));
  const r = top ? Math.min(4, width / 2, h) : 0;
  const d = `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + h} Z`;
  return (
    <>
      <path d={d} fill={fill} />
      {top && payload.key === mark && <text className="chart-value" x={x + width / 2} y={y - 6} textAnchor="middle">{n.format(payload.total)}</text>}
    </>
  );
}

// ───────────────────────────────────────────────────────────── how questions ended (tall segmented bar)

function Outcome({ d }: { d: Insights }) {
  const other = Math.max(0, d.questions - d.answered - d.not_found);
  const parts = [
    { key: "answered", label: "Answered", value: d.answered, color: "var(--series-1)", ink: "#fff" },
    { key: "notFound", label: "Not found", value: d.not_found, color: "var(--series-2)", ink: "#fff" },
    { key: "other", label: "Small talk or blocked", value: other, color: "var(--series-quiet)", ink: "var(--color-ink)" },
  ].filter((x) => x.value > 0);
  const share = (v: number) => Math.round((100 * v) / d.questions);
  return (
    <Card id="ins-outcome" title="How questions ended" note={`All ${plural(d.questions, "question")} in this period.`}>
      <div className="ins-seg" role="img" aria-label={parts.map((x) => `${x.label}: ${x.value} (${share(x.value)}%)`).join(", ")}>
        {parts.map((x) => (
          <span key={x.key} style={{ flexGrow: x.value, background: x.color, color: x.ink }} title={`${x.label}: ${n.format(x.value)} (${share(x.value)}%)`}>
            {share(x.value) >= 9 && `${share(x.value)}%`}
          </span>
        ))}
      </div>
      <ul className="ins-seg-legend">
        {parts.map((x) => (
          <li key={x.key}><i style={{ background: x.color }} aria-hidden="true" /><span>{x.label}</span><strong>{n.format(x.value)}</strong></li>
        ))}
      </ul>
      {d.not_found > 0 && <p className="ins-hint"><Icon name="fileQuestion" className="size-4" /><span>Not found means no document had the answer. Those questions are listed under <a href="#ins-unans-h">Add these documents</a>.</span></p>}
    </Card>
  );
}

// ───────────────────────────────────────────────────────────── by department (ranked horizontal bars)

const deptConfig = { questions: { label: "Questions", color: "var(--series-1)" } } satisfies ChartConfig;

function Departments({ rows }: { rows: Insights["by_department"] }) {
  const still = useReducedMotion();
  return (
    <Card id="ins-dept" title="By department" note="Questions asked by people in each department.">
      {rows.length ? (
        <ChartContainer config={deptConfig} label="Questions by department"
          description={rows.map((r) => `${r.department}: ${r.questions}`).join(", ")}
          style={{ height: rows.length * 40 + 8 }}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap={10} accessibilityLayer>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="department" tickLine={false} axisLine={false} width={116}
              tickFormatter={(s: string) => (s.length > 16 ? `${s.slice(0, 15)}…` : s)} />
            <ChartTooltip cursor={{ fill: "var(--color-paper-2)", stroke: "none", radius: 6 }} isAnimationActive={false}
              content={<ChartTooltipContent valueFormatter={(v) => n.format(v)} />} />
            <Bar dataKey="questions" fill="var(--chart-questions)" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={!still} animationDuration={500}>
              <LabelList dataKey="questions" position="right" offset={8} formatter={(v: unknown) => n.format(Number(v))} />
            </Bar>
          </BarChart>
        </ChartContainer>
      ) : <p className="ins-none">No department data yet.</p>}
    </Card>
  );
}

// ───────────────────────────────────────────────────────────── lists

function Unanswered({ rows }: { rows: Insights["top_unanswered"] }) {
  return (
    <Card id="ins-unans" title="Add these documents" note="Questions Atlas could not answer, most asked first." tone={rows.length ? "warn" : undefined}>
      {rows.length ? (
        <ul className="ins-rows">
          {rows.map((x) => (
            <li key={x.question}>
              <div className="ins-row-main">
                <p className="ins-q">&ldquo;{x.question}&rdquo;</p>
                <p className="ins-row-sub"><span className="badge" data-tone="warn">Asked {x.count}×</span></p>
              </div>
              <Link className="btn ins-row-btn" href="/app/library?upload=1"><Icon name="upload" className="size-4" />Add document</Link>
            </li>
          ))}
        </ul>
      ) : <p className="ins-none ins-ok"><Icon name="check" className="size-4" />Every question found an answer.</p>}
    </Card>
  );
}

function Requests({ rows }: { rows: Insights["document_requests"] }) {
  return (
    <Card id="ins-req" title="Document requests" note="People asked for these after a not-found answer.">
      {rows.length ? (
        <ul className="ins-rows">
          {rows.map((x) => (
            <li key={x.question + x.created_at}>
              <div className="ins-row-main">
                <p className="ins-q">&ldquo;{x.question}&rdquo;</p>
                {x.note && <p className="ins-note">{x.note}</p>}
                <p className="ins-row-sub">{x.by} · {day.format(new Date(x.created_at))}</p>
              </div>
              <Link className="btn ins-row-btn" href="/app/library?upload=1"><Icon name="upload" className="size-4" />Add document</Link>
            </li>
          ))}
        </ul>
      ) : <p className="ins-none">No requests yet.</p>}
    </Card>
  );
}

function TopDocuments({ rows }: { rows: Insights["top_documents"] }) {
  const max = Math.max(1, ...rows.map((r) => r.citations));
  return (
    <Card id="ins-docs" title="Most cited documents" note="Sources used most in answers. Open one to read it.">
      {rows.length ? (
        <ol className="ins-bars">
          {rows.map((x) => (
            <li key={x.document_id}>
              <Link href={`/app/library?doc=${x.document_id}`} aria-label={`${x.title}, ${plural(x.citations, "citation")}. Open the document`}>
                <span className="ins-bar-top">
                  <Icon name="file" className="size-4" />
                  <span className="ins-bar-name">{x.title}</span>
                  <span className="ins-bar-val">{n.format(x.citations)}</span>
                </span>
                <span className="ins-bar-track" aria-hidden="true"><i style={{ width: `${(x.citations / max) * 100}%` }} /></span>
              </Link>
            </li>
          ))}
        </ol>
      ) : <p className="ins-none">No answers cited a document yet.</p>}
    </Card>
  );
}

function Speed({ d }: { d: Insights }) {
  return (
    <Card id="ins-speed" title="Speed and safety" note="How fast answers came and what Atlas turned away.">
      <dl className="ins-mini">
        <div><dt>Average answer time</dt><dd>{ms(d.avg_latency_ms)}</dd></div>
        <div><dt>Slowest 5% (p95)</dt><dd>{ms(d.p95_latency_ms)}</dd></div>
        <div><dt>Blocked</dt><dd>{n.format(d.blocked)}<small>Unsafe or off-limits requests</small></dd></div>
        <div><dt>Small talk</dt><dd>{n.format(d.smalltalk)}<small>Greetings and chit-chat</small></dd></div>
      </dl>
    </Card>
  );
}

const narrowQuery = "(max-width: 40rem)";
function onNarrow(cb: () => void) {
  const m = window.matchMedia(narrowQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
/** Phone width: fewer x-axis labels. */
function useNarrow(): boolean {
  return useSyncExternalStore(onNarrow, () => window.matchMedia(narrowQuery).matches, () => false);
}
