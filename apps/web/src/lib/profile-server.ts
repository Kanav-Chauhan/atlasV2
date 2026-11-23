import { cache } from "react";
import { headers } from "next/headers";
import type { Profile } from "./profile";

const API = process.env.API_URL || "http://localhost:8000";

/** GET /profile with this request's cookies (sidebar picture + company logo). Once per request;
 * null when it fails, so the sidebar falls back to initials and the built-in mark. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const cookie = (await headers()).get("cookie");
  if (!cookie) return null;
  try {
    const res = await fetch(`${API}/profile`, { headers: { cookie }, cache: "no-store" });
    return res.ok ? ((await res.json()) as Profile) : null;
  } catch {
    return null;
  }
});
