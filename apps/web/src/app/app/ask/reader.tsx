"use client";

import { useEffect, useRef } from "react";
import type { Source } from "./ask";

export type Size = "small" | "half" | "full";
const SIZES: Size[] = ["small", "half", "full"];
const PCT = { small: 33, half: 50, full: 100 };
const label = (s: Size) => s[0].toUpperCase() + s.slice(1);

type Props = {
  sources: Source[];
  n: number;
  onN: (n: number) => void;
  size: Size;
  onSize: (s: Size) => void;
  onClose: () => void;
  company: string;
  workspace: React.RefObject<HTMLDivElement | null>;
};

// Option C's document reader: the cited passage on a page, sized small, half or full (phone: full screen with Back).
export function Reader({ sources, n, onN, size, onSize, onClose, company, workspace }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const i = Math.max(0, sources.findIndex((s) => s.n === n));
  const s = sources[i];

  useEffect(() => heading.current?.focus(), [n]);

  // Drag snaps to the nearest size; width never animates.
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = workspace.current?.getBoundingClientRect();
      if (!r) return;
      const f = (r.right - ev.clientX) / r.width;
      onSize(f > 0.75 ? "full" : f > 0.42 ? "half" : "small");
    };
    const up = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };
  const key = (e: React.KeyboardEvent) => {
    const k = SIZES.indexOf(size);
    if (e.key === "ArrowLeft" && k < 2) onSize(SIZES[k + 1]);
    else if (e.key === "ArrowRight" && k > 0) onSize(SIZES[k - 1]);
    else return;
    e.preventDefault();
  };

  if (!s) return null;
  return (
    <section className="reader" aria-labelledby="reader-title">
      <div className="reader-handle" role="separator" tabIndex={0} aria-orientation="vertical" aria-label="Resize document reader"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={PCT[size]} onPointerDown={drag} onKeyDown={key}><span /></div>
      <header className="reader-head">
        <div className="reader-title-row">
          <button type="button" className="btn reader-back" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>Back
          </button>
          <div className="reader-title">
            <h2 id="reader-title" ref={heading} tabIndex={-1}>{s.title}</h2>
            <p>Source {s.n}{s.page != null && `, page ${s.page}`}</p>
          </div>
          <button type="button" className="icon-btn reader-close" aria-label="Close document" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="reader-tools">
          <div className="reader-nav">
            <button type="button" className="icon-btn" aria-label="Previous source" disabled={i === 0} onClick={() => onN(sources[i - 1].n)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <span>{i + 1} of {sources.length}</span>
            <button type="button" className="icon-btn" aria-label="Next source" disabled={i === sources.length - 1} onClick={() => onN(sources[i + 1].n)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <a className="btn" href={`/api/documents/${s.document_id}/file${s.page ? `#page=${s.page}` : ""}`} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
            Open file
          </a>
          <div className="seg" role="group" aria-label="Reader width">
            {SIZES.map((z) => <button key={z} type="button" aria-pressed={size === z} onClick={() => onSize(z)}>{label(z)}</button>)}
          </div>
        </div>
      </header>

      <div className="reader-body">
        <article className="page">
          <div className="letterhead">
            <div><strong>{company}</strong><span>{s.title}</span></div>
            <dl className="doc-control">
              {s.doc_no && <><dt>Doc no.</dt><dd>{s.doc_no}</dd></>}
              {s.page != null && <><dt>Page</dt><dd>{s.page}</dd></>}
            </dl>
          </div>
          {s.superseded && <p className="superseded">A newer version of this document replaces this one.</p>}
          {section(s.section) && <h3>{section(s.section)}</h3>}
          <Passage n={s.n} text={s.text} />
        </article>
      </div>
    </section>
  );
}

// "/Welcome to Nimbus/5. How we work/" → "5. How we work" (the last heading on the path).
const section = (path: string | null) => path?.split("/").filter(Boolean).at(-1) ?? "";
const plain = (t: string) => t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/(^|\W)\*([^*]+)\*/g, "$1$2");

/** The chunk is markdown: drop its own heading (shown above), keep paragraphs, lists and tables. */
function Passage({ n, text }: { n: number; text: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter((b) => b && !/^#{1,6}\s[^\n]*$/.test(b));
  return (
    <div className="passage-text">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter((l) => !/^#{1,6}\s/.test(l));
        const tag = i === 0 ? <span className="mark-tag">{n}</span> : null;
        if (lines.every((l) => l.trim().startsWith("|"))) {
          const rows = lines.filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => plain(c.trim())));
          return (
            <div key={i} className="passage-table">{tag}
              <table><thead><tr>{rows[0].map((c, j) => <th key={j}>{c}</th>)}</tr></thead>
                <tbody>{rows.slice(1).map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
            </div>
          );
        }
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s/.test(l))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}><mark>{j === 0 && tag}{plain(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</mark></li>)}</ul>;
        }
        return <p key={i}><mark>{tag}{plain(lines.join(" "))}</mark></p>;
      })}
    </div>
  );
}
