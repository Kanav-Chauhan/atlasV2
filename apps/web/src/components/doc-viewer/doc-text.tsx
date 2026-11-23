"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import { norm } from "./text";

// Word, Markdown and text documents as formatted text (the API's GET /documents/{id}/text).
// Just enough markdown: headings, paragraphs, lists, tables, quotes, code, rules, **bold**, *italic*.
// Blocks inside the cited passage are highlighted, and the first one scrolls into view.

type Block =
  | { kind: "h"; level: number; text: string }
  | { kind: "p" | "quote"; text: string }
  | { kind: "ul" | "ol"; items: string[]; start?: number }
  | { kind: "table"; rows: string[][] }
  | { kind: "code"; text: string }
  | { kind: "hr" };

const ITEM = /^\s*([-*+•]|\d+[.)])\s+/;
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function parse(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").replace(/<!--.*?-->/g, "").split("\n");
  const out: Block[] = [];
  for (let i = 0; i < lines.length; ) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (/^\s*```/.test(l)) {
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) body.push(lines[i]);
      out.push({ kind: "code", text: body.join("\n") });
      i++;
      continue;
    }
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push({ kind: "h", level: h[1].length, text: h[2].replace(/#+\s*$/, "") }); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push({ kind: "hr" }); i++; continue; }
    if (l.trim().startsWith("|")) {
      const rows: string[][] = [];
      for (; i < lines.length && lines[i].trim().startsWith("|"); i++) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(cells(lines[i]));
      }
      out.push({ kind: "table", rows });
      continue;
    }
    if (ITEM.test(l)) {
      const kind = /^\s*\d/.test(l) ? "ol" : "ul";
      const start = kind === "ol" ? parseInt(l.trim(), 10) : undefined;
      const items: string[] = [];
      for (; i < lines.length && lines[i].trim(); i++) {
        if (ITEM.test(lines[i])) items.push(lines[i].replace(ITEM, ""));
        else items[items.length - 1] += " " + lines[i].trim();
      }
      // Word lists come out as "1. a", blank line, "2. b": keep them as one list.
      const prev = out.at(-1);
      if (prev?.kind === kind) prev.items.push(...items);
      else out.push({ kind, items, start });
      continue;
    }
    if (l.startsWith(">")) {
      const body: string[] = [];
      for (; i < lines.length && lines[i].startsWith(">"); i++) body.push(lines[i].replace(/^>\s?/, ""));
      out.push({ kind: "quote", text: body.join(" ") });
      continue;
    }
    const body: string[] = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*```|\s*\|)/.test(lines[i]) && !ITEM.test(lines[i]); i++) body.push(lines[i].trim());
    out.push({ kind: "p", text: body.join(" ") });
  }
  return out;
}

/** **bold**, *italic* and `code`; links keep their words only. Plain React text, never HTML. */
function inline(s: string) {
  return s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").split(/(\*\*[^*]+\*\*|`[^`]+`|(?<![\w*])\*[^*\s][^*]*\*(?!\w))/).map((t, i) => {
    if (t.startsWith("**") && t.endsWith("**") && t.length > 4) return <strong key={i}>{t.slice(2, -2)}</strong>;
    if (t.startsWith("`") && t.endsWith("`") && t.length > 2) return <code key={i}>{t.slice(1, -1)}</code>;
    if (t.startsWith("*") && t.endsWith("*") && t.length > 2) return <em key={i}>{t.slice(1, -1)}</em>;
    return <Fragment key={i}>{t}</Fragment>;
  });
}

export function DocText({ markdown, plainText, passage }: { markdown: string; plainText?: boolean; passage: string | null }) {
  const root = useRef<HTMLDivElement>(null);
  const blocks = useMemo(() => plainText
    ? markdown.split(/\n\s*\n/).filter((b) => b.trim()).map((text): Block => ({ kind: "p", text }))
    : parse(markdown), [markdown, plainText]);
  const needle = useMemo(() => (passage ? norm(passage) : ""), [passage]);
  // A piece is in the passage when the passage contains it, or (a long paragraph) it contains the passage's start.
  const hit = (s: string) => {
    const t = norm(s);
    return !!needle && t.length >= 12 && (needle.includes(t) || t.includes(needle.slice(0, 80)));
  };

  useEffect(() => {
    root.current?.querySelector(".dv-hit")?.scrollIntoView({ block: "center" });
  }, [needle, blocks]);

  const mark = (on: boolean) => (on ? "dv-hit" : undefined);
  return (
    <div ref={root} className="dv-prose">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h": {
            const H = `h${Math.min(b.level + 1, 6)}` as "h2";
            return <H key={i} className={mark(hit(b.text))}>{inline(b.text)}</H>;
          }
          case "p": return <p key={i} className={mark(hit(b.text))} style={plainText ? { whiteSpace: "pre-wrap" } : undefined}>{plainText ? b.text : inline(b.text)}</p>;
          case "quote": return <blockquote key={i} className={mark(hit(b.text))}>{inline(b.text)}</blockquote>;
          case "code": return <pre key={i} className={mark(hit(b.text))}><code>{b.text}</code></pre>;
          case "hr": return <hr key={i} />;
          case "ul": case "ol": {
            const L = b.kind;
            return <L key={i} start={b.kind === "ol" && b.start !== 1 ? b.start : undefined}>{b.items.map((t, j) => <li key={j} className={mark(hit(t))}>{inline(t)}</li>)}</L>;
          }
          case "table": {
            const [head, ...rows] = b.rows;
            return (
              <div key={i} className="dv-table" tabIndex={0} role="region" aria-label="Table">
                <table>
                  {head && <thead><tr className={mark(hit(head.join(" ")))}>{head.map((c, j) => <th key={j} scope="col">{inline(c)}</th>)}</tr></thead>}
                  <tbody>{rows.map((r, k) => <tr key={k} className={mark(hit(r.join(" ")))}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          }
        }
      })}
    </div>
  );
}
