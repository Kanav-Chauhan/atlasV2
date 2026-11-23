import type { Role } from "./demo-users";

export type NavItem = { slug: string; label: string };
export type NavGroup = { label: string; items: NavItem[] };

// Rail items per role (PLAN.md §3, §7). slug "" is Home at /app.
// The retrieval lab is not a company page: it lives in the Owner area (/super nav) and
// /app/lab opens only for the Atlas owner (lab/page.tsx), so it is in no role's list.
const ITEMS: Record<string, string> = {
  "": "Home", ask: "Ask", library: "Library", team: "Team",
  website: "Website chat", insights: "Insights", agents: "Agent access", settings: "Settings",
};

const BY_ROLE: Record<Role, string[]> = {
  Admin: ["", "ask", "library", "team", "website", "insights", "agents", "settings"],
  Manager: ["", "ask", "library", "team", "insights", "settings"],
  // Everyone has Settings: non-admins see only their Profile there (UI phase 8).
  Member: ["", "ask", "library", "settings"],
  Guest: ["", "ask", "settings"],
};

// Two groups in the rail: daily work, and running the company's Atlas (docs/DECISIONS.md, "UI design base").
const GROUPS: { label: string; slugs: string[] }[] = [
  { label: "Work", slugs: ["", "ask", "library"] },
  { label: "Manage", slugs: ["team", "website", "insights", "agents", "settings"] },
];

export const navFor = (role: Role): NavItem[] => BY_ROLE[role].map((slug) => ({ slug, label: ITEMS[slug] }));

/** The rail's groups for this role; empty groups are dropped. */
export const navGroupsFor = (role: Role): NavGroup[] =>
  GROUPS.map((g) => ({ label: g.label, items: g.slugs.filter((s) => BY_ROLE[role].includes(s)).map((slug) => ({ slug, label: ITEMS[slug] })) }))
    .filter((g) => g.items.length > 0);
