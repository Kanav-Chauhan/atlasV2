import type { Role } from "./demo-users";

export type NavItem = { slug: string; label: string };

// Rail items per role (PLAN.md §3, §7). slug "" is Home at /app.
const ITEMS: Record<string, string> = {
  "": "Home", ask: "Ask", search: "Search", library: "Library", team: "Team",
  "website-chat": "Website chat", insights: "Insights", "agent-access": "Agent access", settings: "Settings",
};

const BY_ROLE: Record<Role, string[]> = {
  Admin: ["", "ask", "search", "library", "team", "website-chat", "insights", "agent-access", "settings"],
  Manager: ["", "ask", "search", "library", "team", "insights"],
  Member: ["", "ask", "search", "library"],
  Guest: ["", "ask", "search"],
};

export const navFor = (role: Role): NavItem[] => BY_ROLE[role].map((slug) => ({ slug, label: ITEMS[slug] }));
