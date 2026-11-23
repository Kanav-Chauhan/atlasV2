"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { type AtlasMessage, Markdown, metaOf, type Source, sourcesOf, textOf } from "@/app/app/ask/ask";
import { DocViewer, type Passage } from "@/components/doc-viewer/doc-viewer";
import { type DocRef, useViewerSize } from "@/components/doc-viewer/use-doc-viewer";
import { Region } from "@/components/region";
import { Card } from "@/components/ui/page";
import { Icon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import type { Paged, VisitorChat } from "@/lib/website";
import { Pager, SearchBox, setUrlChat, useDebounced, when } from "./parts";

// Visitor conversations: one compact, server-paginated list (20 a page) with search, a period
// and a "not found only" filter. A row opens the chat in a side panel (?chat=<id>, so it survives
// a refresh); its sources open the shared document viewer on top.

const PER_PAGE = 20;
const PERIODS = [{ days: 7, label: "7 days" }, { days: 30, label: "30 days" }, { days: 90, label: "90 days" }, { days: 365, label: "1 year" }];
const host = (o: string | null) => (o ? o.replace(/^https?:\/\//, "") : "");

export function Conversations() {
  const [q, setQ] = useState("");
  const [days, setDays] = useState(30);
  const [nf, setNf] = useState(false);
  const [page, setPage] = useState(1);
  const term = useDebounced(q.trim());
  const list = useQuery({
    queryKey: ["visitor-chats", term, days, nf, page],
    queryFn: () => api<Paged<VisitorChat>>(`/website-chat/conversations?${new URLSearchParams({
      q: term, days: String(days), not_found: String(nf), page: String(page), per_page: String(PER_PAGE),
    })}`),
    placeholderData: keepPreviousData,
  });
  const openId = useSearchParams().get("chat");
  const open = openId ? list.data?.items.find((c) => c.id === openId) ?? null : null;
  const filtered = Boolean(term) || nf;

  return (
    <Card title="Visitor conversations" id="vc"
      note={list.data ? `${list.data.total} ${list.data.total === 1 ? "conversation" : "conversations"} in the last ${PERIODS.find((p) => p.days === days)?.label}${filtered ? " matching" : ""}` : " "}>
      <div className="site-filters">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} label="Search conversations" placeholder="Search questions, answers or website" />
        <label className="site-period">
          <span className="sr-only">Period</span>
          <select className="field" value={days} onChange={(e) => { setDays(Number(e.target.value)); setPage(1); }}>
            {PERIODS.map((p) => <option key={p.days} value={p.days}>Last {p.label}</option>)}
          </select>
        </label>
        <button type="button" className="chip" aria-pressed={nf} onClick={() => { setNf(!nf); setPage(1); }}>Not found only</button>
      </div>

      <Region q={list} what="visitor conversations" isEmpty={(d) => d.items.length === 0}
        empty={filtered
          ? <><p className="text-sm font-semibold">No conversation matches</p><button type="button" className="btn" onClick={() => { setQ(""); setNf(false); }}>Clear filters</button></>
          : <><p className="text-sm font-semibold">No visitor conversations in this period</p><p className="text-sm text-muted">When someone uses the bubble on your website, the chat shows up here.</p></>}>
        {(d) => (
          <>
            <ul className="site-rows site-convs" aria-busy={list.isPlaceholderData || undefined}>
              {d.items.map((r) => (
                <li key={r.id}>
                  <button type="button" className="site-conv" aria-current={r.id === openId || undefined} onClick={() => setUrlChat(r.id)}>
                    <span className="site-title">{r.first_question || "(no question)"}</span>
                    <span className="site-conv-meta">
                      {r.not_found && <span className="badge" data-tone="warn"><Icon name="fileQuestion" />Not found</span>}
                      <span>{r.messages} {r.messages === 1 ? "message" : "messages"}</span>
                      {r.origin && <span className="site-origin">{host(r.origin)}</span>}
                      <time dateTime={r.updated_at}>{when.format(new Date(r.updated_at))}</time>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Pager page={page} perPage={PER_PAGE} total={d.total} onPage={setPage} what="Conversations" />
          </>
        )}
      </Region>

      {openId && <ChatPanel id={openId} summary={open} onClose={() => setUrlChat(null)} />}
    </Card>
  );
}

function ChatPanel({ id, summary, onClose }: { id: string; summary: VisitorChat | null; onClose: () => void }) {
  const msgs = useQuery({
    queryKey: ["visitor-chat", id],
    queryFn: () => api<{ id: string; started_at: string; origin: string | null; messages: AtlasMessage[] }>(`/website-chat/conversations/${id}`),
  });
  const [viewer, setViewer] = useState<{ ref: Required<DocRef>; passage: Passage | null } | null>(null);
  const [size, setSize] = useViewerSize();
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => { const o = opener.current; requestAnimationFrame(() => o?.isConnected && o.focus()); };
  }, [id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || viewer || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, viewer]);

  const show = (s: Source) => setViewer({
    ref: { doc: s.document_id, page: s.page, chunk: s.chunk_id, tab: null },
    passage: { text: s.text, section: s.section, page: s.page },
  });
  const started = msgs.data?.started_at ?? summary?.started_at;
  const origin = msgs.data?.origin ?? summary?.origin ?? null;

  return (
    <>
      <div className="site-scrim" aria-hidden="true" onClick={onClose} />
      <aside ref={panel} className="site-chat" role="dialog" aria-modal="true" aria-labelledby="ch-title" tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key !== "Tab" || viewer) return; // keep Tab inside the panel
          const f = panel.current?.querySelectorAll<HTMLElement>("button, a[href], [tabindex='0']");
          if (!f?.length) return;
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }}>
        <header className="site-chat-head">
          <div className="min-w-0">
            <h2 id="ch-title">Visitor conversation</h2>
            <p>
              {started && when.format(new Date(started))}{origin && <> · {host(origin)}</>}
              {msgs.data && <> · {msgs.data.messages.length} messages</>}
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close conversation" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div className="site-chat-body">
          <Region q={msgs} what="conversation" isEmpty={(d) => d.messages.length === 0} empty={<p className="text-sm text-muted">This conversation has no messages.</p>}>
            {(d) => (
              <div className="grid gap-5 text-sm">
                {d.messages.map((m) => {
                  if (m.role === "user") return <p key={m.id} className="q">{textOf(m)}</p>;
                  const sources = sourcesOf(m);
                  if (metaOf(m)?.abstained) {
                    return (
                      <div key={m.id} className="site-nf">
                        <span className="badge" data-tone="warn"><Icon name="fileQuestion" />Not found in website documents</span>
                        {textOf(m) && <p className="text-muted">{textOf(m)}</p>}
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className="a">
                      <Markdown text={textOf(m)} sources={sources} live={false} current={null}
                        onCite={(n) => { const s = sources.find((x) => x.n === n); if (s) show(s); }} />
                      {sources.length > 0 && (
                        <ul className="site-sources" aria-label="Sources">
                          {sources.map((s) => (
                            <li key={s.n}>
                              <button type="button" onClick={() => show(s)}>
                                <span className="site-src-n">{s.n}</span>
                                <span className="min-w-0">{s.title}{s.page ? <small> · page {s.page}</small> : s.section ? <small> · {s.section}</small> : null}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Region>
        </div>
      </aside>
      {viewer && (
        <Suspense>
          <DocViewer mode="overlay" current={viewer.ref} passage={viewer.passage}
            onUpdate={(p) => setViewer((v) => v && { ...v, ref: { ...v.ref, ...p } as Required<DocRef> })}
            onClose={() => setViewer(null)} size={size} onSize={setSize} canSeeChunks />
        </Suspense>
      )}
    </>
  );
}
