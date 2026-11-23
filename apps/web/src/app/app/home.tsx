"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import Link from "next/link";
import { Region } from "@/components/region";
import { Icon, type IconName } from "@/components/ui/icons";
import { Card, Page } from "@/components/ui/page";
import { api } from "@/lib/api";
import type { Role } from "@/lib/demo-users";
import type { ChatSummary, Insights, Review } from "@/lib/types";

// Home, two designs (page.tsx picks one with ?home=a|b). Same data in both:
// everyone: suggested questions + recent chats (deduplicated by question);
// admins and managers: documents past review (coloured by how overdue) + questions Atlas couldn't answer;
// members and guests (no review or insights rights in the API): the documents they can read.

export type HomeProps = { greeting: string; today: string; company: string; role: Role; title: string; departments: string[] };
type Tone = "error" | "warn" | "info" | "success" | "accent";
type LiteDoc = { id: number | string; title: string; access: string; effective: string | null };

const n = new Intl.NumberFormat("en-IN");
const rel = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "15 October 2026" (front-matter style) or "2026-10-15" → Date, else null. */
function parseDay(s: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(s.trim());
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase());
    return month < 0 ? null : new Date(Date.UTC(+m[3], month, +m[1]));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ago(iso: string) {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins > -60) return rel.format(Math.min(mins, -1), "minute");
  if (mins > -60 * 24) return rel.format(Math.round(mins / 60), "hour");
  if (mins > -60 * 24 * 30) return rel.format(Math.round(mins / 1440), "day");
  return rel.format(Math.round(mins / 43200), "month");
}

/** Same question asked twice = one row (newest first, as the API sends them). */
function dedupe(chats: ChatSummary[]) {
  const seen = new Set<string>();
  return chats.filter((c) => {
    const key = (c.title || c.id).trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** How overdue a review is → colour + words. ≥ 90 days red, any days amber, "over a year old" blue. */
function urgency(r: Review) {
  const due = parseDay(r.review);
  const days = due ? Math.floor((Date.now() - due.getTime()) / 86400000) : 0;
  if (due && days > 0) {
    const label = days < 14 ? `${days} days overdue` : days < 60 ? `${Math.round(days / 7)} weeks overdue` : `${Math.round(days / 30)} months overdue`;
    return { days, tone: (days >= 90 ? "error" : "warn") as Tone, label };
  }
  return { days: 0, tone: "info" as Tone, label: "Over a year old" };
}

const TONE_ICON: Record<Tone, IconName> = { error: "alert", warn: "clock", info: "file", success: "check", accent: "sparkle" };

function useHomeData(role: Role) {
  const lead = role === "Admin" || role === "Manager";
  const suggested = useQuery({ queryKey: ["suggested"], staleTime: Infinity, queryFn: () => api<{ questions: string[] }>("/me/suggested") });
  const chats = useQuery({ queryKey: ["chats"], queryFn: () => api<ChatSummary[]>("/chats"), select: dedupe });
  const review = useQuery({
    queryKey: ["review"], enabled: lead, queryFn: () => api<Review[]>("/documents/review"),
    select: (d: Review[]) => d.map((r) => ({ ...r, u: urgency(r) })).sort((a, b) => b.u.days - a.u.days),
  });
  const insights = useQuery({ queryKey: ["insights", 30], enabled: lead, queryFn: () => api<Insights>("/insights?days=30") });
  const docs = useQuery({
    queryKey: ["home-docs"], enabled: !lead, queryFn: () => api<LiteDoc[]>("/documents"),
    select: (d: LiteDoc[]) => [...d].sort((a, b) => (parseDay(b.effective)?.getTime() ?? 0) - (parseDay(a.effective)?.getTime() ?? 0)),
  });
  return { lead, suggested, chats, review, insights, docs };
}
type HomeData = ReturnType<typeof useHomeData>;

/* ── Shared pieces ─────────────────────────────────────────────────────── */

function AskForm({ id, size }: { id: string; size: "lg" | "md" }) {
  return (
    <form action="/app/ask" className="home-ask" data-size={size} role="search">
      <Icon name="sparkle" className="home-ask-icon" />
      <label className="sr-only" htmlFor={id}>Ask about any company document</label>
      <input id={id} name="q" required className="home-ask-input" placeholder="Ask about any company document…" autoComplete="off" />
      <button type="submit" className="btn btn-primary">Ask<Icon name="send" /></button>
    </form>
  );
}

function Suggestions({ q, layout }: { q: HomeData["suggested"]; layout: "chips" | "list" }) {
  return (
    <Region q={q} what="suggested questions" rows={layout === "chips" ? 1 : 3} isEmpty={(d) => d.questions.length === 0}
      empty={<p className="text-sm text-muted">No suggestions yet. Type any question.</p>}>
      {(d) => layout === "chips" ? (
        <ul className="home-chips" aria-label="Try asking">
          {d.questions.map((s) => <li key={s}><Link className="home-chip" href={`/app/ask?q=${encodeURIComponent(s)}`}>{s}</Link></li>)}
        </ul>
      ) : (
        <ul className="home-rows">
          {d.questions.map((s) => (
            <li key={s}><Link className="home-row" href={`/app/ask?q=${encodeURIComponent(s)}`}>
              <span className="home-row-icon" data-tone="accent"><Icon name="sparkle" className="size-4" /></span>
              <span className="home-row-main"><span className="home-row-title">{s}</span></span>
              <Icon name="arrowRight" className="size-4 text-muted" />
            </Link></li>
          ))}
        </ul>
      )}
    </Region>
  );
}

function ChatRows({ q, limit }: { q: UseQueryResult<ChatSummary[]>; limit: number }) {
  return (
    <Region q={q} what="recent chats"
      empty={<><p className="text-sm font-semibold">No chats yet</p><p className="text-sm text-muted">Your questions and answers stay here.</p></>}>
      {(d) => (
        <ul className="home-rows">
          {d.slice(0, limit).map((c) => (
            <li key={c.id}><Link className="home-row" href={`/app/ask?c=${c.id}`}>
              <span className="home-row-icon"><Icon name="ask" className="size-4" /></span>
              <span className="home-row-main"><span className="home-row-title">{c.title || "Untitled chat"}</span></span>
              <span className="home-row-meta">{ago(c.updated_at)}</span>
            </Link></li>
          ))}
        </ul>
      )}
    </Region>
  );
}

type Ranked = Review & { u: ReturnType<typeof urgency> };

function ReviewRows({ q, limit }: { q: UseQueryResult<Ranked[]>; limit: number }) {
  return (
    <Region q={q} what="review list"
      empty={<><p className="text-sm font-semibold">Nothing to review</p><p className="text-sm text-muted">Documents past their review date show up here.</p></>}>
      {(d) => (
        <>
          <ul className="home-rows">
            {d.slice(0, limit).map((r) => (
              <li key={r.id}><a className="home-row" href={`/api/documents/${r.id}/file`} target="_blank" rel="noreferrer">
                <span className="home-row-icon" data-tone={r.u.tone}><Icon name={TONE_ICON[r.u.tone]} className="size-4" /></span>
                <span className="home-row-main">
                  <span className="home-row-title">{r.title}</span>
                  <span className="home-row-sub">{r.access}{r.review ? ` · review was due ${r.review}` : ""}</span>
                </span>
                <span className="badge" data-tone={r.u.tone}>{r.u.label}</span>
              </a></li>
            ))}
          </ul>
          {d.length > limit && <p className="text-sm text-muted">And {d.length - limit} more in the Library.</p>}
        </>
      )}
    </Region>
  );
}

/** Not a copy of Insights: only what someone should act on (questions with no answer → add documents). */
function Gaps({ q, compact = false }: { q: HomeData["insights"]; compact?: boolean }) {
  return (
    <Region q={q} what="unanswered questions" rows={2} isEmpty={() => false} empty={null}>
      {(d) => d.not_found === 0 ? (
        <p className="home-callout" data-tone="success"><Icon name="check" className="size-5" />Every question in the last 30 days found an answer in your documents.</p>
      ) : (
        <div className="grid gap-3">
          <p className="home-callout" data-tone="warn">
            <Icon name="fileQuestion" className="size-5" />
            <span><strong>{n.format(d.not_found)} {d.not_found === 1 ? "question" : "questions"}</strong> found no answer in your documents in the last 30 days.
              {d.document_requests.length > 0 && <> {n.format(d.document_requests.length)} people asked for a document.</>}</span>
          </p>
          {!compact && d.top_unanswered.length > 0 && (
            <ul className="home-rows">
              {d.top_unanswered.slice(0, 3).map((u) => (
                <li key={u.question} className="home-row home-row-static">
                  <span className="home-row-main"><span className="home-row-title">&ldquo;{u.question}&rdquo;</span></span>
                  <span className="home-row-meta">asked {u.count}×</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-primary" href="/app/library"><Icon name="upload" />Add documents</Link>
            <Link className="btn" href="/app/insights">See all questions</Link>
          </div>
        </div>
      )}
    </Region>
  );
}

function DocRows({ q, limit, linked }: { q: UseQueryResult<LiteDoc[]>; limit: number; linked: boolean }) {
  return (
    <Region q={q} what="your documents"
      empty={<><p className="text-sm font-semibold">No documents yet</p><p className="text-sm text-muted">Documents shared with you show up here.</p></>}>
      {(d) => (
        <>
          <p className="text-sm text-muted">You can ask about <strong className="text-ink">{n.format(d.length)} documents</strong>. Newest first:</p>
          <ul className="home-rows">
            {d.slice(0, limit).map((doc) => {
              const row = (
                <>
                  <span className="home-row-icon"><Icon name="file" className="size-4" /></span>
                  <span className="home-row-main">
                    <span className="home-row-title">{doc.title}</span>
                    <span className="home-row-sub">{doc.access}{doc.effective ? ` · from ${doc.effective}` : ""}</span>
                  </span>
                </>
              );
              return <li key={doc.id}>{linked ? <a className="home-row" href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer">{row}</a> : <span className="home-row home-row-static">{row}</span>}</li>;
            })}
          </ul>
        </>
      )}
    </Region>
  );
}

function Who({ p }: { p: HomeProps }) {
  return (
    <p className="home-who">
      <span className="badge" data-tone="accent">{p.role}</span>
      <span>{p.title}{p.departments.length ? ` · ${p.departments.join(", ")}` : ""}</span>
    </p>
  );
}

/* ── Option A: hero ask card + two-column cards ────────────────────────── */

export function HomeA(p: HomeProps) {
  const h = useHomeData(p.role);
  return (
    <Page className="home home-a">
      <section className="home-hero" aria-labelledby="home-h">
        <p className="eyebrow">{p.company} · {p.today}</p>
        <h1 id="home-h">{p.greeting}</h1>
        <Who p={p} />
        <AskForm id="home-q" size="lg" />
        <div className="grid gap-2">
          <p className="home-label">Try asking</p>
          <Suggestions q={h.suggested} layout="chips" />
        </div>
      </section>

      <div className="home-grid">
        <Card id="recent" title="Continue where you left off" note="Your latest chats" action={<Link className="link" href="/app/ask">New chat</Link>}>
          <ChatRows q={h.chats} limit={5} />
        </Card>
        {h.lead ? (
          <Card id="gaps" title="Questions Atlas couldn't answer" note="Fill the gaps so the next person gets an answer">
            <Gaps q={h.insights} />
          </Card>
        ) : (
          <Card id="docs" title={p.role === "Guest" ? "What you can ask about" : "In your library"} note={`Shared with ${p.departments.join(", ") || "you"}`}
            action={p.role !== "Guest" ? <Link className="link" href="/app/library">Open Library</Link> : undefined}>
            <DocRows q={h.docs} limit={4} linked={p.role !== "Guest"} />
          </Card>
        )}
      </div>

      {h.lead && (
        <Card id="review" title={<>Needs review <ReviewCount q={h.review} /></>} note="Documents past their review date, most overdue first"
          action={<Link className="link" href="/app/library">Library</Link>}>
          <ReviewRows q={h.review} limit={5} />
        </Card>
      )}
    </Page>
  );
}

function ReviewCount({ q }: { q: UseQueryResult<Ranked[]> }) {
  if (!q.data?.length) return null;
  const worst = q.data[0].u.tone;
  return <span className="badge ml-1 align-middle" data-tone={worst}>{q.data.length}</span>;
}

/* ── Option B: command centre (stat tiles + to-do list) ────────────────── */

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const w = 100, hgt = 28, step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(hgt - (v / max) * (hgt - 2) - 1).toFixed(1)}`);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${hgt}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="spark-area" d={`M0,${hgt} L${pts.join(" L")} L${w},${hgt} Z`} />
      <path className="spark-line" d={`M${pts.join(" L")}`} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Tile({ icon, tone, label, value, sub, href, cta, children }: {
  icon: IconName; tone: Tone; label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string; cta?: string; children?: React.ReactNode;
}) {
  return (
    <div className="tile" data-tone={tone}>
      <div className="tile-top">
        <span className="tile-icon"><Icon name={icon} className="size-[18px]" /></span>
        <span className="tile-label">{label}</span>
      </div>
      <div className="tile-value">{value}</div>
      {children}
      {sub && <p className="tile-sub">{sub}</p>}
      {href && cta && <Link className="tile-link" href={href}>{cta}<Icon name="arrowRight" className="size-3.5" /></Link>}
    </div>
  );
}

const TileSkeleton = () => <div className="tile"><div className="skeleton h-[92px]" /></div>;

function LeadTiles({ h }: { h: HomeData }) {
  const ins = h.insights.data, rev = h.review.data, chats = h.chats.data;
  if (!ins || !rev || !chats) {
    if (h.insights.isError || h.review.isError) return <p className="state text-sm" role="alert">Some numbers didn&apos;t load. Reload to try again.</p>;
    return <div className="tiles">{[0, 1, 2, 3].map((i) => <TileSkeleton key={i} />)}</div>;
  }
  const worst = rev[0]?.u;
  return (
    <div className="tiles">
      <Tile icon="check" tone="success" label="Answered, 30 days" value={ins.answered_pct == null ? "None yet" : `${Math.round(ins.answered_pct)}%`}
        sub={`${n.format(ins.answered)} of ${n.format(ins.questions)} questions`}>
        <Spark values={ins.per_day.map((d) => d.questions)} />
      </Tile>
      <Tile icon="fileQuestion" tone={ins.not_found ? "warn" : "success"} label="No answer found" value={n.format(ins.not_found)}
        sub={ins.not_found ? "Add documents that cover them" : "Nothing missing this month"} href="/app/library" cta={ins.not_found ? "Add documents" : undefined} />
      <Tile icon="clock" tone={worst ? worst.tone : "success"} label="Overdue reviews" value={n.format(rev.length)}
        sub={worst ? `Oldest: ${worst.label}` : "All documents are current"} href="/app/library" cta={rev.length ? "Review" : undefined} />
      <Tile icon="ask" tone="accent" label="Your chats" value={n.format(chats.length)}
        sub={chats[0] ? `Last one ${ago(chats[0].updated_at)}` : "Ask your first question"} href="/app/ask" cta="New chat" />
    </div>
  );
}

function MemberTiles({ h, p }: { h: HomeData; p: HomeProps }) {
  const docs = h.docs.data, chats = h.chats.data;
  if (!docs || !chats) {
    if (h.docs.isError || h.chats.isError) return <p className="state text-sm" role="alert">Some numbers didn&apos;t load. Reload to try again.</p>;
    return <div className="tiles" data-count="3">{[0, 1, 2].map((i) => <TileSkeleton key={i} />)}</div>;
  }
  return (
    <div className="tiles" data-count="3">
      <Tile icon="library" tone="accent" label="Documents you can ask about" value={n.format(docs.length)}
        sub={`Shared with ${p.departments.join(", ")}`} href={p.role !== "Guest" ? "/app/library" : undefined} cta="Open Library" />
      <Tile icon="ask" tone="info" label="Your chats" value={n.format(chats.length)}
        sub={chats[0] ? `Last one ${ago(chats[0].updated_at)}` : "Ask your first question"} href="/app/ask" cta="New chat" />
      <Tile icon="file" tone="success" label="Newest document" value={<span className="tile-value-text">{docs[0]?.title ?? "None yet"}</span>}
        sub={docs[0]?.effective ? `In effect from ${docs[0].effective}` : undefined} />
    </div>
  );
}

type Task = { key: string; tone: Tone; icon: IconName; title: string; sub: string; badge: string; href: string; external?: boolean; rank: number };

function TodoList({ h }: { h: HomeData }) {
  const ins = h.insights.data, rev = h.review.data;
  if (h.review.isPending || h.insights.isPending) return <div className="grid gap-2" aria-busy="true" aria-label="Loading your to-do list">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}</div>;
  if (h.review.isError || h.insights.isError) return <div className="state" role="alert"><p className="text-sm font-semibold">Your to-do list didn&apos;t load</p><p className="text-sm text-muted">Reload the page to try again.</p></div>;
  const rank: Record<Tone, number> = { error: 0, warn: 1, info: 2, success: 3, accent: 3 };
  const tasks: Task[] = [
    ...(rev ?? []).map((r): Task => ({
      key: `r${r.id}`, tone: r.u.tone, icon: TONE_ICON[r.u.tone], title: `Review “${r.title}”`,
      sub: `${r.access}${r.review ? ` · was due ${r.review}` : ""}`, badge: r.u.label, href: `/api/documents/${r.id}/file`, external: true, rank: rank[r.u.tone] * 1e6 - r.u.days,
    })),
    ...(ins?.top_unanswered ?? []).map((u): Task => ({
      key: `u${u.question}`, tone: "warn", icon: "fileQuestion", title: `Add a document that answers “${u.question}”`,
      sub: `Asked ${u.count}× with no answer`, badge: "No answer", href: "/app/library", rank: rank.warn * 1e6,
    })),
  ];
  // Keep room for up to two unanswered questions, so they are not pushed out by a long review list.
  const asks = tasks.filter((t) => t.key.startsWith("u")).slice(0, 2);
  const shown = [...tasks.filter((t) => t.key.startsWith("r")).slice(0, 6 - asks.length), ...asks].sort((a, b) => a.rank - b.rank);

  if (!tasks.length) return <p className="home-callout" data-tone="success"><Icon name="check" className="size-5" />You&apos;re all caught up. Nothing needs review and every question found an answer.</p>;
  return (
    <>
      <ul className="home-rows">
        {shown.map((t) => {
          const inner = (
            <>
              <span className="home-row-icon" data-tone={t.tone}><Icon name={t.icon} className="size-4" /></span>
              <span className="home-row-main"><span className="home-row-title">{t.title}</span><span className="home-row-sub">{t.sub}</span></span>
              <span className="badge" data-tone={t.tone}>{t.badge}</span>
            </>
          );
          return <li key={t.key}>{t.external ? <a className="home-row" href={t.href} target="_blank" rel="noreferrer">{inner}</a> : <Link className="home-row" href={t.href}>{inner}</Link>}</li>;
        })}
      </ul>
      {tasks.length > shown.length && <p className="text-sm text-muted">{tasks.length - shown.length} more in the <Link className="link" href="/app/library">Library</Link>.</p>}
    </>
  );
}

function TaskCount({ h }: { h: HomeData }) {
  const total = (h.review.data?.length ?? 0) + (h.insights.data?.top_unanswered.length ?? 0);
  if (!total) return null;
  return <span className="badge ml-1 align-middle" data-tone={h.review.data?.[0]?.u.tone ?? "warn"}>{total}</span>;
}

export function HomeB(p: HomeProps) {
  const h = useHomeData(p.role);
  return (
    <Page className="home home-b">
      <header className="home-b-head">
        <div className="grid gap-1.5 min-w-0">
          <p className="eyebrow">{p.today}</p>
          <h1>{p.greeting}</h1>
          <Who p={p} />
        </div>
        <AskForm id="home-q" size="md" />
      </header>

      {h.lead ? <LeadTiles h={h} /> : <MemberTiles h={h} p={p} />}

      <div className="home-b-grid">
        {h.lead ? (
          <Card id="todo" title={<>Your to-do <TaskCount h={h} /></>} note="Most urgent first. Red: over 3 months overdue.">
            <TodoList h={h} />
          </Card>
        ) : (
          <Card id="recent" title="Pick up where you left off" note="Your latest chats" action={<Link className="link" href="/app/ask">New chat</Link>}>
            <ChatRows q={h.chats} limit={6} />
          </Card>
        )}
        <div className="grid content-start gap-[var(--page-gap)]">
          {h.lead && (
            <Card id="recent" title="Recent chats" action={<Link className="link" href="/app/ask">New chat</Link>}>
              <ChatRows q={h.chats} limit={4} />
            </Card>
          )}
          <Card id="sugg" title="Try asking" note="Picked for your departments">
            <Suggestions q={h.suggested} layout="list" />
          </Card>
        </div>
      </div>
    </Page>
  );
}
