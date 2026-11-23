import { clerkMiddleware } from "@clerk/nextjs/server";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";
import { CLERK_ON } from "@/lib/clerk";
import { ATLAS_ORIGIN, publicConfig } from "@/lib/website";

// The website chat panel (/embed/<key>) may only be framed by Atlas itself and the company's
// allowed websites (GET /public/<key>/config → allowed_origins). Cached 60 s per key.
const TTL = 60_000;
const cache = new Map<string, { at: number; ancestors: string }>();
const ORIGIN = /^https?:\/\/[a-z0-9.-]+(:\d+)?$/;

async function ancestors(key: string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.ancestors;
  const config = await publicConfig(key);
  const origins = (config?.allowed_origins ?? []).filter((o) => ORIGIN.test(o));
  const value = ["'self'", ...new Set([ATLAS_ORIGIN, ...origins])].join(" ");
  if (cache.size > 1000) cache.clear();
  cache.set(key, { at: Date.now(), ancestors: value });
  return value;
}

async function embed(req: NextRequest) {
  const key = req.nextUrl.pathname.split("/")[2] ?? "";
  const res = NextResponse.next();
  res.headers.set("Content-Security-Policy", `frame-ancestors ${await ancestors(key)}`);
  return res;
}

// Clerk keeps the session cookie fresh (handshake) on the signed-in pages only. It never runs on
// /embed (framed on other sites), /widget.js, /demo-site or /api/* (the API checks the token).
const clerk = CLERK_ON ? clerkMiddleware() : null;

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  if (req.nextUrl.pathname.startsWith("/embed/")) return embed(req);
  return clerk ? clerk(req, event) : NextResponse.next();
}

export const config = {
  matcher: ["/embed/:path*", "/sign-in/:path*", "/sign-up/:path*", "/onboarding", "/auth/owner", "/app/:path*"],
};
