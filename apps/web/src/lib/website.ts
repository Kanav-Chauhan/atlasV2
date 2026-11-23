// Website chat shapes (docs/API.md "Endpoints (Phase 8: website chat)").

export type PublicConfig = {
  company: string; greeting: string; accent: string; position: "right" | "left"; show_badge: boolean;
  allowed_origins: string[]; // sites that may frame /embed (always includes Atlas itself)
};

export type WebsiteChat = {
  enabled: boolean; site_key: string; allowed_origins: string[]; greeting: string;
  accent: string; position: "right" | "left"; show_badge: boolean; public_documents: number;
};

export type VisitorChat = { id: string; started_at: string; origin: string | null; messages: number; last_question: string; not_found: boolean };

export const HEX = /^#[0-9a-fA-F]{6}$/;

/** Black or white text, whichever reads better on a #rrggbb fill (same rule as widget.js). */
export function inkOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#111111" : "#ffffff";
}

export const ATLAS_ORIGIN = "https://p1.kanav.space";

export const snippet = (key: string) =>
  `<script src="${ATLAS_ORIGIN}/widget.js" data-atlas-key="${key}" async></script>`;

/** Server-side: the public config for a site key, or null (unknown, disabled, API down). */
export async function publicConfig(key: string): Promise<PublicConfig | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(key)) return null;
  try {
    // The API only answers allowed origins; this call is Atlas itself (the /embed page and proxy).
    const res = await fetch(`${process.env.API_URL || "http://localhost:8000"}/public/${key}/config`, {
      cache: "no-store", headers: { origin: ATLAS_ORIGIN },
    });
    return res.ok ? ((await res.json()) as PublicConfig) : null;
  } catch {
    return null;
  }
}
