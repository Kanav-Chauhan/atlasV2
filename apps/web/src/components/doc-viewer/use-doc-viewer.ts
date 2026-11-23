"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";

// The open document lives in the URL (?doc=<id>&page=<n>&chunk=<chunk id>&tab=chunks), so a refresh
// or a shared link reopens it. history.replaceState updates useSearchParams without a server
// round trip, so turning PDF pages never refetches the page underneath.

export type DocRef = { doc: string; page?: number | null; chunk?: string | null; tab?: "chunks" | null };
export type Size = "small" | "half" | "full";

let opener: HTMLElement | null = null;

function write(patch: Partial<Record<"doc" | "page" | "chunk" | "tab", string | number | null | undefined>>) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  }
  // null state: Next only syncs useSearchParams for replaceState calls that aren't its own (its own carry __NA).
  window.history.replaceState(null, "", url);
}

export function useDocViewer() {
  const params = useSearchParams();
  const doc = params.get("doc");
  const page = Number(params.get("page")) || null;
  const current: Required<DocRef> | null = doc && /^\d+$/.test(doc)
    ? { doc, page, chunk: params.get("chunk"), tab: params.get("tab") === "chunks" ? "chunks" : null }
    : null;

  const open = useCallback((ref: DocRef) => {
    // Remember what opened it, so closing returns focus there (not on a refresh: nothing to return to).
    if (!window.location.search.includes("doc=")) opener = document.activeElement as HTMLElement | null;
    write({ doc: ref.doc, page: ref.page, chunk: ref.chunk, tab: ref.tab });
  }, []);
  const update = useCallback((patch: Partial<DocRef>) => write(patch), []);
  const close = useCallback(() => {
    write({ doc: null, page: null, chunk: null, tab: null });
    const back = opener;
    opener = null;
    // The row that opened it may have re-rendered; fall back to the page's main heading.
    requestAnimationFrame(() => (back?.isConnected ? back : document.querySelector<HTMLElement>("main h1"))?.focus());
  }, []);

  return { current, open, update, close };
}

/** Small / Half / Full, remembered per browser (a convenience: kept in memory when storage is blocked). */
let memory: Size = "half";
const listeners = new Set<() => void>();
function readSize(): Size {
  try {
    const s = localStorage.getItem("atlas-viewer-size");
    if (s === "small" || s === "half" || s === "full") return s;
  } catch {}
  return memory;
}
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

export function useViewerSize(): [Size, (s: Size) => void] {
  const size = useSyncExternalStore(subscribe, readSize, () => "half" as Size);
  const set = useCallback((s: Size) => {
    memory = s;
    try { localStorage.setItem("atlas-viewer-size", s); } catch {}
    listeners.forEach((f) => f());
  }, []);
  return [size, set];
}
