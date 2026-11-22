"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Doc } from "./library";

type Chunk = { chunk_id: string; index: number; page: number | null; section: string | null; tokens: number; text: string };
const SIZES = ["Small", "Half", "Full"] as const;

// Side panel listing a document's chunks, sized like option C's reader.
export function ChunkPanel({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [size, setSize] = useState<(typeof SIZES)[number]>("Half");
  const heading = useRef<HTMLHeadingElement>(null);
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["chunks", doc.id],
    queryFn: () => api<Chunk[]>(`/documents/${doc.id}/chunks`),
  });

  useEffect(() => heading.current?.focus(), [doc.id]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <aside className="chunk-panel" data-size={size.toLowerCase()} aria-labelledby="chunk-title">
      <header className="chunk-head">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="chunk-title" ref={heading} tabIndex={-1} className="text-lg font-semibold">{doc.title}</h2>
            <p className="text-sm text-muted">
              {doc.doc_no ? `${doc.doc_no}, ` : ""}{data ? `${data.length} ${data.length === 1 ? "chunk" : "chunks"}` : "Chunks"}
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close chunks" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="seg" role="group" aria-label="Panel width">
          {SIZES.map((s) => <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)}>{s}</button>)}
        </div>
      </header>

      <div className="chunk-body">
        {error ? (
          <section className="state" role="alert">
            <h3 className="font-body text-md font-semibold">The chunks didn&apos;t load</h3>
            <p className="text-sm text-muted">{error.message}</p>
            <button type="button" className="btn" onClick={() => refetch()}>Retry</button>
          </section>
        ) : isPending ? (
          <div className="grid gap-3" aria-busy="true" aria-label="Loading chunks">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton chunk-skeleton" />)}
          </div>
        ) : data.length === 0 ? (
          <section className="state">
            <h3 className="font-body text-md font-semibold">No chunks yet</h3>
            <p className="text-sm text-muted">Chunks appear once the document has been read and split.</p>
          </section>
        ) : (
          <ol className="chunk-list">
            {data.map((c) => (
              <li key={c.chunk_id} className="chunk">
                <div className="chunk-meta">
                  <strong>Chunk {c.index}</strong>
                  {c.page != null && <span>Page {c.page}</span>}
                  <span>{c.tokens} tokens</span>
                  {c.section && <span className="chunk-section">{c.section}</span>}
                </div>
                <p className="chunk-text">{c.text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
