"use client";

import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { type Chunk, ChunkList } from "./chunk-list";
import { DocText } from "./doc-text";
import { lastHeading } from "./text";
import type { DocRef, Size } from "./use-doc-viewer";
import "./doc-viewer.css";

// The one document viewer (UI Phase 2): Ask, Search, Library and later the website-chat log open
// documents here, on the side, never as a download. PDFs are drawn as real pages (pdf.js, loaded
// only when a PDF opens); Word, Markdown and text show as formatted text. "How Atlas reads this"
// lists the chunks for people who may see them. Download is a separate, explicit button.

const PdfPages = lazy(() => import("./pdf-pages"));

export type DocMeta = {
  id: number; title: string; doc_no: string | null; access: string; is_public: boolean; format: string;
  status: "queued" | "processing" | "ready" | "failed"; error: string | null; pages: number | null;
  updated_at: string; superseded_by: string | null;
};
/** A cited passage the opener already has (Ask); otherwise the viewer looks it up by chunk id. */
export type Passage = { text: string; section: string | null; page: number | null };
/** Ask: the answer's sources, to step through them without closing the viewer. */
export type SourceNav = { index: number; total: number; go: (i: number) => void };

const SIZES: Size[] = ["small", "half", "full"];
const PCT = { small: 33, half: 50, full: 100 };
const STATUS = { ready: "Ready", processing: "Processing", queued: "Queued", failed: "Failed" } as const;
const FORMAT: Record<string, string> = { pdf: "PDF", docx: "Word", md: "Markdown", txt: "Text" };
const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const PHONE = "(max-width: 60rem)";

const Icon = ({ d, w = 2 }: { d: string; w?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

type Props = {
  current: Required<DocRef>;
  onUpdate: (patch: Partial<DocRef>) => void;
  onClose: () => void;
  /** overlay: a side sheet over the page (Search, Library). docked: a column of its parent grid (Ask). */
  mode: "overlay" | "docked";
  size: Size;
  onSize: (s: Size) => void;
  canSeeChunks: boolean;
  company?: string;
  passage?: Passage | null;
  sources?: SourceNav | null;
};

export function DocViewer({ current, onUpdate, onClose, mode, size, onSize, canSeeChunks, company, passage: given, sources }: Props) {
  const { doc: id, chunk, tab: urlTab } = current;
  const tab = canSeeChunks && urlTab === "chunks" ? "chunks" : "doc";
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState(false);
  const [pages, setPages] = useState<number | null>(null);
  const [page, setPage] = useState<number | null>(current.page);
  const [jump, setJump] = useState<{ page: number; nonce: number } | null>(current.page ? { page: current.page, nonce: 0 } : null);
  const [pdfFailed, setPdfFailed] = useState(false);

  const meta = useQuery({
    queryKey: ["document", id], queryFn: () => api<DocMeta>(`/documents/${id}`),
    retry: (n, e) => n < 1 && ((e as Error & { status?: number }).status ?? 500) >= 500,
  });
  const d = meta.data;
  const isPdf = d?.format === "pdf";
  const chunks = useQuery({
    queryKey: ["chunks", id], queryFn: () => api<Chunk[]>(`/documents/${id}/chunks`),
    enabled: !!d && (tab === "chunks" || (!!chunk && !given)),
  });
  const text = useQuery({
    queryKey: ["document-text", id], queryFn: () => api<{ format: string; markdown: string }>(`/documents/${id}/text`),
    enabled: !!d && !isPdf && (d.status === "ready" || d.format === "md" || d.format === "txt"),
  });

  const found = chunk ? chunks.data?.find((c) => c.chunk_id === chunk) : undefined;
  const passage: Passage | null = given ?? (found ? { text: found.text, section: found.section, page: found.page } : null);

  // New document or citation: focus the title, reset page state, jump to the cited page.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [id, chunk]);
  const [seen, setSeen] = useState({ id, chunk });
  if (seen.id !== id || seen.chunk !== chunk) {
    setSeen({ id, chunk });
    if (seen.id !== id) { setPages(null); setPdfFailed(false); }
    setPage(current.page);
    setJump((j) => (current.page ? { page: current.page, nonce: (j?.nonce ?? 0) + 1 } : null));
  }

  useEffect(() => {
    const mq = matchMedia(PHONE);
    const set = () => setPhone(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  // Esc closes (unless a dialog or the Ask history drawer took it first).
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      onClose();
    };
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [onClose]);

  // Focus stays inside while the viewer covers the page (side sheet, Full, phone).
  const trap = mode === "overlay" || size === "full" || phone;
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!trap || e.key !== "Tab" || !root.current) return;
    const items = [...root.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea')]
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0], last = items.at(-1)!;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  // Drag snaps to the nearest size; width never animates.
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const area = () => (mode === "docked" ? root.current?.parentElement : document.querySelector("main"))?.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const r = area();
      if (!r) return;
      const f = (r.right - ev.clientX) / r.width;
      onSize(f > 0.75 ? "full" : f > 0.42 ? "half" : "small");
    };
    const up = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };
  const sizeKey = (e: React.KeyboardEvent) => {
    const k = SIZES.indexOf(size);
    if (e.key === "ArrowLeft" && k < 2) onSize(SIZES[k + 1]);
    else if (e.key === "ArrowRight" && k > 0) onSize(SIZES[k - 1]);
    else return;
    e.preventDefault();
  };

  const onPages = useCallback((n: number) => setPages(n), []);
  const onFail = useCallback(() => setPdfFailed(true), []);
  const onPage = useCallback((n: number) => { setPage(n); onUpdate({ page: n }); }, [onUpdate]);
  const goPage = (n: number) => { setPage(n); setJump((j) => ({ page: n, nonce: (j?.nonce ?? 0) + 1 })); onUpdate({ page: n }); };
  const setTab = (t: "doc" | "chunks") => onUpdate({ tab: t === "chunks" ? "chunks" : null });
  const tabKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = tab === "doc" ? "chunks" : "doc";
    setTab(next);
    document.getElementById(`dv-tab-${next}`)?.focus();
  };

  const status = (meta.error as (Error & { status?: number }) | null)?.status;
  const title = d?.title ?? (meta.isPending ? "Opening document…" : status === 404 ? "Document not available" : "Document");
  const pdfPassage = passage && isPdf ? { text: passage.text, page: passage.page } : null;

  return (
    <>
      {mode === "overlay" && !phone && size !== "full" && <div className="dv-scrim" aria-hidden="true" onClick={onClose} />}
      <section ref={root} className="dv" data-mode={mode} data-size={size} aria-labelledby="dv-title" onKeyDown={onKeyDown}
        role={trap ? "dialog" : "region"} aria-modal={trap || undefined}>
        <div className="dv-handle" role="separator" tabIndex={0} aria-orientation="vertical" aria-label="Resize document viewer"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={PCT[size]} onPointerDown={drag} onKeyDown={sizeKey}><span /></div>

        <header className="dv-head">
          <div className="dv-title-row">
            <button type="button" className="btn dv-back" onClick={onClose}><Icon d="M15 5l-7 7 7 7" />Back</button>
            <div className="dv-title">
              <h2 id="dv-title" ref={heading} tabIndex={-1}>{title}</h2>
              {d && (
                <p className="dv-meta">
                  <span className="dv-dept">{d.access}</span>
                  {d.doc_no && <span>{d.doc_no}</span>}
                  <span className={`dv-status dv-status-${d.status}`}>{STATUS[d.status]}</span>
                  <span>Updated {date.format(new Date(d.updated_at))}</span>
                  <span>{FORMAT[d.format] ?? d.format.toUpperCase()}</span>
                  {d.is_public && <span className="tag">Public</span>}
                </p>
              )}
            </div>
            {d && (
              <a className="btn dv-download" href={`/api/documents/${id}/file`} download>
                <Icon w={1.8} d="M12 4v11M7 10l5 5 5-5M5 20h14" /><span className="dv-download-label">Download</span>
                <span className="sr-only">: {d.title} ({FORMAT[d.format] ?? d.format})</span>
              </a>
            )}
            <button type="button" className="icon-btn dv-close" aria-label="Close document" onClick={onClose}><Icon d="M6 6l12 12M18 6L6 18" /></button>
          </div>

          {d && (
            <div className="dv-tools">
              {canSeeChunks ? (
                <div className="dv-tabs" role="tablist" aria-label="View">
                  <button id="dv-tab-doc" type="button" role="tab" aria-selected={tab === "doc"} aria-controls="dv-panel" tabIndex={tab === "doc" ? 0 : -1} onClick={() => setTab("doc")} onKeyDown={tabKey}>Document</button>
                  <button id="dv-tab-chunks" type="button" role="tab" aria-selected={tab === "chunks"} aria-controls="dv-panel" tabIndex={tab === "chunks" ? 0 : -1} onClick={() => setTab("chunks")} onKeyDown={tabKey}>How Atlas reads this</button>
                </div>
              ) : <span />}
              <div className="dv-tools-end">
                {sources && sources.total > 1 && (
                  <div className="dv-pager" role="group" aria-label="Sources">
                    <button type="button" className="icon-btn" aria-label="Previous source" disabled={sources.index === 0} onClick={() => sources.go(sources.index - 1)}><Icon d="M15 5l-7 7 7 7" /></button>
                    <span>Source {sources.index + 1} of {sources.total}</span>
                    <button type="button" className="icon-btn" aria-label="Next source" disabled={sources.index === sources.total - 1} onClick={() => sources.go(sources.index + 1)}><Icon d="M9 5l7 7-7 7" /></button>
                  </div>
                )}
                {isPdf && tab === "doc" && pages != null && (
                  <div className="dv-pager" role="group" aria-label="Pages">
                    <button type="button" className="icon-btn" aria-label="Previous page" disabled={(page ?? 1) <= 1} onClick={() => goPage((page ?? 1) - 1)}><Icon d="M15 5l-7 7 7 7" /></button>
                    <span aria-live="polite">Page {page ?? 1} of {pages}</span>
                    <button type="button" className="icon-btn" aria-label="Next page" disabled={(page ?? 1) >= pages} onClick={() => goPage((page ?? 1) + 1)}><Icon d="M9 5l7 7-7 7" /></button>
                  </div>
                )}
                <div className="seg dv-sizes" role="group" aria-label="Viewer width">
                  {SIZES.map((z) => <button key={z} type="button" aria-pressed={size === z} onClick={() => onSize(z)}>{z[0].toUpperCase() + z.slice(1)}</button>)}
                </div>
              </div>
            </div>
          )}
        </header>

        <div ref={body} className="dv-body" id="dv-panel" role={canSeeChunks && d ? "tabpanel" : undefined}
          aria-labelledby={canSeeChunks && d ? `dv-tab-${tab}` : undefined} tabIndex={-1}>
          {meta.error ? (
            status === 404 ? (
              <section className="state dv-state" role="alert">
                <Icon w={1.6} d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" />
                <h3 className="font-body text-md font-semibold">You can&apos;t open this document</h3>
                <p className="text-sm text-muted">It may have been removed, or it belongs to a department you&apos;re not in. Someone who manages it can share it with you.</p>
                <button type="button" className="btn" onClick={onClose}>Close</button>
              </section>
            ) : (
              <section className="state dv-state" role="alert">
                <h3 className="font-body text-md font-semibold">This document didn&apos;t open</h3>
                <p className="text-sm text-muted">{meta.error.message}</p>
                <button type="button" className="btn" onClick={() => meta.refetch()}>Retry</button>
              </section>
            )
          ) : !d ? (
            <div className="grid gap-3" aria-busy="true" aria-label="Loading document"><div className="skeleton" /><div className="skeleton dv-sheet-skeleton" /></div>
          ) : tab === "chunks" ? (
            <ChunkList query={chunks} current={chunk} />
          ) : (
            <>
              {d.superseded_by && <p className="dv-note" role="note">A newer version replaces this document{/^\d+$/.test(d.superseded_by) ? "" : `: ${d.superseded_by}`}.</p>}
              {isPdf ? (
                <>
                  {passage && <PassageStrip passage={passage} onGo={passage.page ? () => goPage(passage.page!) : undefined} />}
                  {pdfFailed ? (
                    <Unavailable id={id} what="This PDF couldn't be shown here." />
                  ) : (
                    <Suspense fallback={<div className="dv-sheet skeleton" style={{ aspectRatio: "1 / 1.414" }} />}>
                      <PdfPages url={`/api/documents/${id}/file?inline=1`} scroller={body} jump={jump} passage={pdfPassage}
                        onPages={onPages} onPage={onPage} onFail={onFail} />
                    </Suspense>
                  )}
                </>
              ) : text.data ? (
                <article className="dv-paper">
                  <div className="dv-letterhead">
                    <div><strong>{company || d.access}</strong><span>{d.title}</span></div>
                    <dl>
                      {d.doc_no && <><dt>Doc no.</dt><dd>{d.doc_no}</dd></>}
                      <dt>Updated</dt><dd>{date.format(new Date(d.updated_at))}</dd>
                    </dl>
                  </div>
                  {passage && lastHeading(passage.section) && <p className="dv-cited-label">Cited: {lastHeading(passage.section)}</p>}
                  <DocText markdown={text.data.markdown} plainText={d.format === "txt"} passage={passage?.text ?? null} />
                </article>
              ) : text.error ? (
                <section className="state dv-state" role="alert">
                  <h3 className="font-body text-md font-semibold">The text didn&apos;t load</h3>
                  <p className="text-sm text-muted">{text.error.message}</p>
                  <button type="button" className="btn" onClick={() => text.refetch()}>Retry</button>
                </section>
              ) : d.status !== "ready" && d.format === "docx" ? (
                <Unavailable id={id} what={d.status === "failed" ? `Atlas couldn't read this file${d.error ? `: ${d.error}` : "."}` : "Atlas is still reading this file. It shows here when it's ready."} />
              ) : (
                <div className="grid gap-3" aria-busy="true" aria-label="Loading text"><div className="skeleton dv-sheet-skeleton" /></div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}

function PassageStrip({ passage, onGo }: { passage: Passage; onGo?: () => void }) {
  const heading = lastHeading(passage.section);
  return (
    <details className="dv-passage" open>
      <summary>
        <span className="dv-passage-label">Cited passage</span>
        {heading && <span className="dv-passage-section">{heading}</span>}
        {passage.page != null && <span className="dv-passage-page">Page {passage.page}</span>}
      </summary>
      <div className="dv-passage-body"><DocText markdown={passage.text} passage={null} /></div>
      {onGo && <button type="button" className="btn dv-passage-go" onClick={onGo}>Show it on page {passage.page}</button>}
    </details>
  );
}

function Unavailable({ id, what }: { id: string; what: string }) {
  return (
    <section className="state dv-state">
      <h3 className="font-body text-md font-semibold">{what}</h3>
      <p className="text-sm text-muted">You can still download the original file.</p>
      <a className="btn" href={`/api/documents/${id}/file`} download>Download</a>
    </section>
  );
}
