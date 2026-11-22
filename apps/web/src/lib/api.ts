// Browser-side calls to /api (proxied to the API with the demo cookie).

/** The API's plain-English error, or a fallback. */
export async function detail(res: Response) {
  const body = await res.json().catch(() => null);
  if (typeof body?.detail === "string") return body.detail;
  return res.status >= 500 ? "The Atlas server isn't answering right now." : `The server answered ${res.status}.`;
}

export async function api<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, body === undefined && method === "POST" ? { cache: "no-store" } : {
      method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("The request didn't reach the server. Check your connection and try again.");
  }
  if (!res.ok) throw Object.assign(new Error(await detail(res)), { status: res.status });
  return res.status === 204 ? (undefined as T) : res.json();
}
