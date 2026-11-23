import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CLERK_ON } from "@/lib/clerk";
import { ATLAS_ORIGIN } from "@/lib/website";

const API = process.env.API_URL || "http://localhost:8000";

// Where every Clerk sign-in lands. The Atlas owner (a verified email in
// ATLAS_SUPERADMIN_CLERK_EMAILS) gets the signed atlas_super cookie from the API and goes to the
// Owner area; everyone else goes on to /app (their company, or onboarding).
// Redirects use the public origin: inside the container the request URL is http://0.0.0.0:3000.
export async function GET() {
  const to = (path: string) => NextResponse.redirect(new URL(path, ATLAS_ORIGIN));
  if (!CLERK_ON) return to("/login?owner=1");
  const { userId, getToken } = await auth();
  if (!userId) return to("/sign-in?redirect_url=/auth/owner");
  const token = await getToken();
  const res = await fetch(`${API}/auth/super/clerk`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  const value = res?.status === 204 ? /atlas_super=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1] : undefined;
  if (!value) return to("/app");
  const out = to("/super");
  out.cookies.set("atlas_super", value, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
  return out;
}
