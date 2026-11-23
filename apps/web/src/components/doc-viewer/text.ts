// Text helpers shared by the viewer's PDF, text and passage views.

/** Markdown markers out, spaces collapsed, lower case: so PDF text, file text and chunk text compare fairly. */
export const norm = (s: string) =>
  s.replace(/<!--.*?-->/g, " ").replace(/[*_`#>|]+/g, " ").replace(/^\s*([-•]|\d+[.)])\s+/gm, " ")
    .replace(/\s+/g, " ").trim().toLowerCase();

/** **bold** and *italic* markers out (for short labels). */
export const plain = (t: string) => t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/(^|\W)\*([^*]+)\*/g, "$1$2");

/** "/Welcome to Nimbus/5. How we work/" → "5. How we work" (the last heading on the path). */
export const lastHeading = (path: string | null | undefined) => path?.split("/").filter(Boolean).at(-1) ?? "";
