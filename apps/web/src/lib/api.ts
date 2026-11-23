// Browser-side calls to /api (proxied to the API with the cookies: the demo cookie, or Clerk's
// short-lived __session for real users).

type ClerkGlobal = { session?: { getToken(o?: { skipCache?: boolean }): Promise<string | null> } | null };

/** Clerk's __session cookie lives ~60 s and clerk-js renews it in the background; after a sleeping
 * tab the first call can carry a stale one. Renew it now (true) so the call can be retried once. */
export async function renewedClerkSession() {
  const clerk = (globalThis as { Clerk?: ClerkGlobal }).Clerk;
  if (!clerk?.session) return false;
  try {
    return Boolean(await clerk.session.getToken({ skipCache: true }));
  } catch {
    return false;
  }
}

/** The API's plain-English error, or a fallback. */
export async function detail(res: Response) {
  const body = await res.json().catch(() => null);
  if (typeof body?.detail === "string") return body.detail;
  return res.status >= 500 ? "The Atlas server isn't answering right now." : `The server answered ${res.status}.`;
}

export async function api<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const send = () => fetch(`/api${path}`, body === undefined && method === "POST" ? { cache: "no-store" } : {
    method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && (await renewedClerkSession())) res = await send();
  } catch {
    throw new Error("The request didn't reach the server. Check your connection and try again.");
  }
  if (!res.ok) throw Object.assign(new Error(await detail(res)), { status: res.status });
  return res.status === 204 ? (undefined as T) : res.json();
}
