// The Library's filters live in the URL (?q=&dept=&type=&status=&public=1&sort=title&p=2) so a
// refresh or a shared link shows the same page. `p`, not `page`: the document viewer already uses
// ?page= for the PDF page it shows. Shared by the server page (first paint) and the client list.

export type LibraryDoc = {
  id: number;
  title: string;
  doc_no: string | null;
  access: string;
  is_public: boolean;
  format: string;
  status: "queued" | "processing" | "ready" | "failed";
  error: string | null;
  pages: number | null;
  updated_at: string;
  superseded_by: string | null;
  /** Why it needs review; only on documents this person may manage. */
  review: string | null;
};

export type LibraryPage = {
  items: LibraryDoc[];
  total: number;
  page: number;
  per_page: number;
  all: number;
  counts: { ready: number; processing: number; failed: number };
  departments: string[];
};

export const PER_PAGE = 20;
export const TYPES = { pdf: "PDF", docx: "Word", md: "Markdown", txt: "Text" } as const;
export const STATUSES = { ready: "Ready", processing: "Processing", failed: "Failed", review: "Needs review" } as const;
export const SORTS = { updated: "Recently updated", title: "Title A–Z" } as const;
export const FILTER_KEYS = ["q", "dept", "type", "status", "public"] as const;

const pick = <T extends object>(map: T, v: string | null) => (v && v in map ? v : "");

/** URL search params → the API's query string for GET /documents/library. */
export function libraryQuery(url: URLSearchParams): string {
  const out = new URLSearchParams();
  const q = (url.get("q") ?? "").trim().slice(0, 200);
  if (q) out.set("q", q);
  const dept = (url.get("dept") ?? url.get("access") ?? "").slice(0, 100); // ?access= was the old key
  if (dept) out.set("dept", dept);
  const type = pick(TYPES, url.get("type"));
  if (type) out.set("format", type);
  const status = pick(STATUSES, url.get("status"));
  if (status) out.set("status", status);
  if (url.get("public") === "1") out.set("public", "true");
  if (url.get("sort") === "title") out.set("sort", "title");
  const p = Math.max(1, Math.min(10_000, Math.floor(Number(url.get("p"))) || 1));
  out.set("page", String(p));
  out.set("per_page", String(PER_PAGE));
  return out.toString();
}
