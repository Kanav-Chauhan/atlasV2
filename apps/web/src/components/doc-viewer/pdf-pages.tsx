"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { norm } from "./text";

// The PDF drawn as real pages with pdf.js (pdfjs-dist). pdf.js itself and its worker are loaded
// only when a PDF opens (dynamic import; the worker file is bundled by Next from node_modules, no CDN).
// Pages draw when they come near the view. Text items of the cited passage get a highlight
// (best effort: an item is marked when its text is inside the passage, on the cited page or the next).

type Pdfjs = typeof import("pdfjs-dist");
let lib: Promise<Pdfjs> | null = null;
function pdfjs() {
  lib ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return m;
  });
  return lib;
}

type Props = {
  url: string;
  scroller: React.RefObject<HTMLDivElement | null>;
  /** Scroll here when it changes (nonce: the same page again still jumps). */
  jump: { page: number; nonce: number } | null;
  passage: { text: string; page: number | null } | null;
  onPages: (n: number) => void;
  onPage: (n: number) => void;
  onFail: () => void;
};

export default function PdfPages({ url, scroller, jump, passage, onPages, onPage, onFail }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<{ lib: Pdfjs; doc: PDFDocumentProxy; sizes: { w: number; h: number }[] } | null>(null);
  const [width, setWidth] = useState(0);
  const marked = useRef(false);

  useEffect(() => {
    let gone = false;
    let task: ReturnType<Pdfjs["getDocument"]> | null = null;
    pdfjs().then(async (lib) => {
      task = lib.getDocument({ url, withCredentials: true });
      const doc = await task.promise;
      const pages = await Promise.all(Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1)));
      if (gone) return;
      const sizes = pages.map((p) => { const v = p.getViewport({ scale: 1 }); return { w: v.width, h: v.height }; });
      setPdf({ lib, doc, sizes });
      onPages(doc.numPages);
    }).catch(() => !gone && onFail());
    return () => { gone = true; task?.destroy(); };
  }, [url, onPages, onFail]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width / 8) * 8));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Jump to a page (first load: the cited page; later: the page buttons).
  useEffect(() => {
    if (!jump || !pdf || !width) return;
    box.current?.querySelector(`[data-page="${jump.page}"]`)?.scrollIntoView({ block: "start" });
  }, [jump, pdf, width]);

  // Which page is on screen: the last one whose top passed a third of the view.
  useEffect(() => {
    const sc = scroller.current;
    if (!sc || !pdf) return;
    let last = 0;
    const tick = () => {
      const line = sc.getBoundingClientRect().top + sc.clientHeight / 3;
      let n = 1;
      for (const el of sc.querySelectorAll<HTMLElement>("[data-page]")) if (el.getBoundingClientRect().top <= line) n = Number(el.dataset.page);
      if (n !== last) { last = n; onPage(n); }
    };
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); };
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => { sc.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [scroller, pdf, onPage]);

  const needle = useMemo(() => (passage ? norm(passage.text) : ""), [passage]);
  useEffect(() => { marked.current = false; }, [needle]);
  // The first highlighted line scrolls into view once per passage.
  const onMarked = useCallback((el: HTMLElement) => {
    if (marked.current) return;
    marked.current = true;
    el.scrollIntoView({ block: "center" });
  }, []);
  const pageW = Math.min(width, 900);

  return (
    <div ref={box} className="dv-pdf" aria-busy={!pdf}>
      {!pdf ? (
        <div className="dv-sheet skeleton" style={{ aspectRatio: "1 / 1.414" }} aria-label="Loading the PDF" />
      ) : pageW > 0 && pdf.sizes.map((s, i) => (
        <Page key={i} lib={pdf.lib} doc={pdf.doc} n={i + 1} size={s} width={pageW} total={pdf.sizes.length}
          needle={passage?.page != null && (i + 1 === passage.page || i === passage.page) ? needle : ""}
          onMarked={onMarked} />
      ))}
    </div>
  );
}

type PageProps = {
  lib: Pdfjs; doc: PDFDocumentProxy; n: number; total: number; size: { w: number; h: number }; width: number;
  needle: string; onMarked: (el: HTMLElement) => void;
};

function Page({ lib, doc, n, total, size, width, needle, onMarked }: PageProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [hits, setHits] = useState(0);
  const scale = width / size.w;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!near || !el) return;
    let gone = false;
    let render: RenderTask | null = null;
    let text: InstanceType<Pdfjs["TextLayer"]> | null = null;
    doc.getPage(n).then(async (page: PDFPageProxy) => {
      if (gone) return;
      const viewport = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.setAttribute("aria-hidden", "true");
      render = page.render({ canvas, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] });
      await render.promise;
      if (gone) return;
      const layer = document.createElement("div");
      layer.className = "textLayer";
      text = new lib.TextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport });
      await text.render();
      if (gone) return;
      el.querySelector(".dv-sheet-inner")?.replaceChildren(canvas, layer);
      let first: HTMLElement | null = null;
      let count = 0;
      if (needle) for (const div of text.textDivs) {
        const t = norm(div.textContent ?? "");
        if ((t.length >= 8 || (t.length >= 4 && t.includes(" "))) && needle.includes(t)) {
          div.classList.add("dv-hit");
          first ??= div;
          count++;
        }
      }
      setHits(count);
      if (first) onMarked(first);
    }).catch(() => {}); // cancelled renders throw; the page simply stays blank until drawn again
    return () => { gone = true; render?.cancel(); text?.cancel(); };
  }, [near, doc, lib, n, scale, needle, onMarked]);

  return (
    <section ref={wrap} className="dv-sheet" data-page={n}
      aria-label={`Page ${n} of ${total}${hits ? ", has the cited passage" : ""}`}
      style={{ width, aspectRatio: `${size.w} / ${size.h}`, ["--total-scale-factor" as string]: scale, ["--scale-round-x" as string]: "1px", ["--scale-round-y" as string]: "1px" }}>
      <div className="dv-sheet-inner" />
    </section>
  );
}
