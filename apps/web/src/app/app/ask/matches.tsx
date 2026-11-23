"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { DocRef } from "@/components/doc-viewer/use-doc-viewer";
import { api } from "@/lib/api";

// "Matching documents": the API search endpoint (POST /search, permission-filtered by the API),
// grouped to one row per document. Beside an answer it runs in parallel with the stream;
// in "Just find documents" mode it is the whole page (no AI answer, no LLM cost).

export type Hit = {
  chunk_id: string; document_id: string | number; title: string; doc_no: string | null; access: string;
  page: number | null; section: string | null; text: string; score: number; superseded: boolean;
};
type SearchResponse = { q: string; took_ms: number; results: Hit[] };
type Match = Hit & { more: number };

const STOP = new Set(["the", "and", "for", "are", "how", "what", "who", "when", "does", "with", "from", "that", "this", "can", "many", "much"]);

/** Wraps the query's words in <mark>. */
function Highlight({ text, q }: { text: string; q: string }) {
  const words = q.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)?.filter((w) => !STOP.has(w)) ?? [];
  if (!words.length) return text;
  // Word starts only ("days" marks "days" and "days'", not the end of "holidays").
  const re = new RegExp(`((?<![\\p{L}\\p{N}])(?:${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "giu");
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

/** Passages are stored as markdown; a snippet shows the words without heading hashes, bold stars or table rules. */
const plain = (t: string) => t
  .replace(/(^|\s)#{1,6}\s+/g, "$1")
  .replace(/\*\*|__/g, "")
  .replace(/(^|\s)\*(?=\S)|(?<=\S)\*(?=\s|[.,;:!?)]|$)/g, "$1")
  .replace(/\|?(\s*:?-{3,}:?\s*\|)+\s*:?-*:?/g, " ")
  .replace(/\s*\|\s*/g, " · ")
  .replace(/(?:\s*·\s*){2,}/g, " · ")
  .replace(/^\s*·\s*|\s*·\s*$/g, "")
  .replace(/\s{2,}/g, " ")
  .trim();

/** Best passage per document, in rank order; `more` counts the document's other passages. */
function byDocument(hits: Hit[]): Match[] {
  const seen = new Map<string, Match>();
  for (const h of hits) {
    const m = seen.get(String(h.document_id));
    if (m) m.more++;
    else seen.set(String(h.document_id), { ...h, more: 0 });
  }
  return [...seen.values()];
}

export const useMatches = (q: string, topK: number) => useQuery({
  queryKey: ["search", q, topK], enabled: !!q, staleTime: 60_000,
  queryFn: () => api<SearchResponse>("/search", { q, top_k: topK }),
  select: (d) => ({ ...d, docs: byDocument(d.results) }),
});

type Props = {
  q: string;
  /** side: a column beside the answer (a collapsible row above the composer on narrow screens). full: find mode. */
  variant: "side" | "full";
  openChunk: string | null;
  onOpen: (ref: DocRef, hit: Hit) => void;
};

export function Matches({ q, variant, openChunk, onOpen }: Props) {
  const res = useMatches(q, variant === "full" ? 20 : 10);
  const [open, setOpen] = useState(false);
  const docs = res.data?.docs;
  const count = docs ? ` (${docs.length})` : "";

  const body = res.error ? (
    <section className="state" role="alert">
      <h3 className="font-body text-md font-semibold">The search didn&apos;t finish</h3>
      <p className="text-sm text-muted">{res.error.message}</p>
      <button type="button" className="btn" onClick={() => res.refetch()}>Retry</button>
    </section>
  ) : !docs ? (
    <div className="grid gap-2" aria-busy="true" aria-label="Finding documents">
      {Array.from({ length: variant === "full" ? 4 : 3 }, (_, i) => <div key={i} className="skeleton match-skeleton" />)}
    </div>
  ) : docs.length === 0 ? (
    <p className="text-sm text-muted">No document you can open matches these words. Try other words or a document number.</p>
  ) : (
    <ol className="match-list" aria-busy={res.isFetching}>
      {docs.map((m) => (
        <li key={m.chunk_id}>
          <button type="button" className="match" aria-current={openChunk === m.chunk_id || undefined}
            onClick={() => onOpen({ doc: String(m.document_id), page: m.page, chunk: m.chunk_id }, m)}>
            <span className="match-title">{m.title}</span>
            <span className="match-meta">
              {m.doc_no && <span>{m.doc_no}</span>}
              {variant === "full" && m.access && <span>{m.access}</span>}
              {m.page != null && <span>Page {m.page}</span>}
              {m.more > 0 && <span>+{m.more} more {m.more === 1 ? "passage" : "passages"}</span>}
              {m.superseded && <span className="tag tag-warn">Superseded</span>}
            </span>
            <span className="match-text"><Highlight text={plain(m.text)} q={q} /></span>
            <span className="sr-only">Open in the document viewer</span>
          </button>
        </li>
      ))}
    </ol>
  );

  if (variant === "full") return (
    <section className="matches-full" aria-labelledby="find-h">
      <h2 id="find-h" className="font-body text-md font-semibold">Documents matching “{q}”</h2>
      <p className="text-xs text-muted" role="status">
        {docs ? `${docs.length} ${docs.length === 1 ? "document" : "documents"} in ${res.data!.took_ms} ms` : res.isFetching ? "Searching…" : ""}
      </p>
      {body}
    </section>
  );

  return (
    <aside className="matches" aria-labelledby="matches-h" data-open={open}>
      <button type="button" className="matches-toggle" aria-expanded={open} aria-controls="matches-body" onClick={() => setOpen(!open)}>
        <span>Matching documents{count}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <h2 id="matches-h" className="matches-title">Matching documents{count}</h2>
      <div id="matches-body" className="matches-body">
        <p className="matches-for">For: {q}</p>
        {body}
      </div>
    </aside>
  );
}
