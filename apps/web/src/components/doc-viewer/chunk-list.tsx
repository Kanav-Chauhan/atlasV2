"use client";

import { useEffect, useRef } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

export type Chunk = { chunk_id: string; index: number; page: number | null; section: string | null; tokens: number; text: string };

// "How Atlas reads this": the pieces (chunks) Atlas split the document into, the same pieces
// search and answers use. The cited one is marked and scrolled to. (Was the Library's Chunks panel.)
export function ChunkList({ query, current }: { query: UseQueryResult<Chunk[], Error>; current: string | null }) {
  const list = useRef<HTMLOListElement>(null);
  const { data, error, isPending, refetch } = query;

  useEffect(() => {
    list.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "center" });
  }, [data, current]);

  if (error) return (
    <section className="state" role="alert">
      <h3 className="font-body text-md font-semibold">The chunks didn&apos;t load</h3>
      <p className="text-sm text-muted">{error.message}</p>
      <button type="button" className="btn" onClick={() => refetch()}>Retry</button>
    </section>
  );
  if (isPending) return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading chunks">
      {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton dv-chunk-skeleton" />)}
    </div>
  );
  if (data.length === 0) return (
    <section className="state">
      <h3 className="font-body text-md font-semibold">No chunks yet</h3>
      <p className="text-sm text-muted">Chunks appear once the document has been read and split.</p>
    </section>
  );
  return (
    <>
      <p className="dv-chunk-intro">
        Atlas split this document into {data.length} {data.length === 1 ? "piece" : "pieces"}. Search and answers find and quote these pieces, never the whole file.
      </p>
      <ol ref={list} className="dv-chunks">
        {data.map((c) => (
          <li key={c.chunk_id} className="dv-chunk" aria-current={c.chunk_id === current || undefined}>
            <div className="dv-chunk-meta">
              <strong>Chunk {c.index + 1}</strong>
              {c.page != null && <span>Page {c.page}</span>}
              <span>{c.tokens} tokens</span>
              {c.chunk_id === current && <span className="tag">Cited</span>}
              {c.section && c.section !== "/" && <span className="dv-chunk-section">{c.section.split("/").filter(Boolean).join(" › ")}</span>}
            </div>
            <p className="dv-chunk-text">{c.text}</p>
          </li>
        ))}
      </ol>
    </>
  );
}
