"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Region } from "@/components/region";
import { api } from "@/lib/api";
import { day, type ChatSummary, type Insights, type Review } from "@/lib/types";
import { Stats } from "./insights/insights";

export function HomeData({ manage }: { manage: boolean }) {
  const suggested = useQuery({ queryKey: ["suggested"], staleTime: Infinity, queryFn: () => api<{ questions: string[] }>("/me/suggested") });
  const chats = useQuery({ queryKey: ["chats"], queryFn: () => api<ChatSummary[]>("/chats") });

  return (
    <>
      <section className="block" aria-labelledby="sugg-h">
        <h2 id="sugg-h" className="font-body text-sm font-semibold text-muted">Try asking</h2>
        <Region q={suggested} what="suggested questions" rows={1} isEmpty={(d) => d.questions.length === 0}
          empty={<p className="text-sm text-muted">No suggestions yet. Type any question above.</p>}>
          {(d) => (
            <div className="flex flex-wrap gap-2">
              {d.questions.map((q) => <Link key={q} className="chip inline-flex items-center no-underline" href={`/app/ask?q=${encodeURIComponent(q)}`}>{q}</Link>)}
            </div>
          )}
        </Region>
      </section>

      <div className="two-col">
        <section className="block" aria-labelledby="recent-h">
          <div className="block-head">
            <h2 id="recent-h">Recent chats</h2>
            <Link className="link" href="/app/ask">New chat</Link>
          </div>
          <Region q={chats} what="recent chats"
            empty={<><p className="text-sm font-semibold">No chats yet</p><p className="text-sm text-muted">Your questions and answers stay here.</p></>}>
            {(d) => (
              <ul className="list">
                {d.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link href={`/app/ask?c=${c.id}`}>{c.title || "Untitled chat"}</Link>
                    <span className="count">{day.format(new Date(c.updated_at))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Region>
        </section>
        {manage && <NeedsReview />}
      </div>

      {manage && <ThisMonth />}
    </>
  );
}

function NeedsReview() {
  const review = useQuery({ queryKey: ["review"], queryFn: () => api<Review[]>("/documents/review") });
  return (
    <section className="block" aria-labelledby="review-h">
      <div className="block-head">
        <h2 id="review-h">Needs review</h2>
        <Link className="link" href="/app/library">Library</Link>
      </div>
      <Region q={review} what="review list"
        empty={<><p className="text-sm font-semibold">Nothing to review</p><p className="text-sm text-muted">Documents past their review date show up here.</p></>}>
        {(d) => (
          <ul className="list">
            {d.slice(0, 5).map((r) => (
              <li key={r.id}>
                <span className="grid min-w-0">
                  <a href={`/api/documents/${r.id}/file`} target="_blank" rel="noreferrer">{r.title}</a>
                  <span className="text-xs text-muted">{r.reason}</span>
                </span>
                <span className="count">{r.access}</span>
              </li>
            ))}
          </ul>
        )}
      </Region>
    </section>
  );
}

function ThisMonth() {
  const insights = useQuery({ queryKey: ["insights", 30], queryFn: () => api<Insights>("/insights?days=30") });
  return (
    <section className="block" aria-labelledby="month-h">
      <div className="block-head">
        <h2 id="month-h">This month</h2>
        <Link className="link" href="/app/insights">All insights</Link>
      </div>
      <Region q={insights} what="monthly numbers" rows={1} isEmpty={(d) => d.questions === 0}
        empty={<p className="text-sm text-muted">No questions in the last 30 days yet.</p>}>
        {(d) => <Stats d={d} />}
      </Region>
    </section>
  );
}
