// Shapes from docs/API.md "Endpoints (Phase 7: dashboard)". Ids are numbers; percentages are 0-100.

export type ApiRole = "admin" | "manager" | "member" | "guest";

export type Person = {
  id: number; name: string; email: string; title: string; role: ApiRole;
  departments: string[]; guest_until: string | null; last_active: string | null;
};

export type Department = { name: string; description: string; members: number };

export type Access = {
  departments: string[];
  people: { id: number; name: string; role: ApiRole; can_read: Record<string, boolean>; everyone: true }[];
};

export type Review = { id: number; title: string; access: string; effective: string | null; review: string | null; reason: string };

export type Insights = {
  questions: number; answered: number; not_found: number; blocked: number; smalltalk: number;
  /** null when no question reached the documents (only small talk or blocked). */
  answered_pct: number | null; avg_latency_ms: number | null; p95_latency_ms: number | null;
  feedback: { up: number; down: number };
  top_unanswered: { question: string; count: number }[];
  document_requests: { question: string; note: string | null; by: string; created_at: string }[];
  top_documents: { document_id: number; title: string; citations: number }[];
  by_department: { department: string; questions: number }[];
  /** Zero-filled, oldest first; answered + not_found ≤ questions (the rest is small talk / blocked). */
  per_day: { date: string; questions: number; answered: number; not_found: number }[];
  /** The same totals for the period just before this one (for the change figures). */
  previous: { questions: number; answered: number; not_found: number; answered_pct: number | null; helpful: number };
  /** How many of these questions are sample history (demo companies only). */
  sample?: number;
};

export type Org = { slug: string; name: string; industry: string; description: string };

export type ChatSummary = { id: string; title: string; updated_at: string };

export const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
