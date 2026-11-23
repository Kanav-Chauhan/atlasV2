// Settings + profile (docs/API.md "Settings and profile", UI phase 8).
import { detail } from "./api";
import type { ApiRole } from "./types";

export type Profile = {
  id: number; email: string; name: string; title: string; role: ApiRole; departments: string[];
  guest_until: string | null; avatar_url: string | null;
  org: { slug: string; name: string; logo_url: string | null };
};

export type OrgSettings = {
  access_defaults: { role: "manager" | "member" | "guest"; departments: string[]; guest_days: number };
  notifications: { weekly_summary: boolean; review_reminders: boolean };
  logo_url: string | null;
};

export type AutoJoin = {
  domains: string[]; role: ApiRole; departments: string[]; available: boolean; allowed_domains: string[];
};

export const MAX_IMAGE_MB = 2;

/** PUT a picture (multipart `file`) to /api<path>; throws the API's plain-English error. */
export async function uploadImage<T>(path: string, blob: Blob, filename: string): Promise<T> {
  const body = new FormData();
  body.append("file", blob, filename);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method: "PUT", body });
  } catch {
    throw new Error("The upload didn't reach the server. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(await detail(res));
  return res.json();
}
