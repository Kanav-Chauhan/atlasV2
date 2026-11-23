// Team & access API shapes (docs/API.md "Team for big companies"). Person/Department live in lib/types.
import type { ApiRole, Person } from "@/lib/types";

export type Status = "active" | "invited" | "expired";
export type Member = Person & { status: Status };

export type PeoplePage = { people: Member[]; total: number; page: number; per_page: number };

export type Group = {
  name: string; description: string; people: number; documents: number;
  reads: string[]; managers: string[]; managers_more: number;
};
export type Groups = {
  total: number; roles: Record<ApiRole, number>; no_group: number;
  everyone: { people: number; documents: number }; groups: Group[];
};

export type BulkOut = { changed: number; errors: { id: number; name: string; error: string }[] };

export type ImportRow = {
  line: number; email: string; name: string; title: string; role: string; groups: string[];
  error: string | null; invite: string | null;
};
export type ImportOut = { dry_run: boolean; rows: ImportRow[]; valid: number; invalid: number; created: number };

export type AutoJoin = { domains: string[]; role: ApiRole; departments: string[]; available: boolean; allowed_domains: string[] };

export type Filters = { q: string; role: string; dept: string; status: string; page: number };

export const ROLES: ApiRole[] = ["admin", "manager", "member", "guest"];
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
export const nf = new Intl.NumberFormat("en-IN");
export const people = (n: number) => `${nf.format(n)} ${n === 1 ? "person" : "people"}`;
