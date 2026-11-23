"use client";

import { useId, useState } from "react";

// Join the waitlist (POST /api/public/waitlist → Clerk waitlist; the owner approves people in the
// Owner area). Used on /login and on the Clerk sign-in / sign-up pages while Clerk is in Waitlist mode.
export function WaitlistForm({ source }: { source: string }) {
  const id = useId();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState("error");
      setMsg("That address looks incomplete. Write it as name@example.com.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/public/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, website: String(f.get("website") ?? "") }),
      });
      if (res.ok) {
        (globalThis as { atlasTrack?: (e: string, p?: object) => void }).atlasTrack?.("waitlist_joined", { source });
        setState("done");
        setMsg(`You're on the list. We'll email ${email} when your invite is ready.`);
        return;
      }
      const body = await res.json().catch(() => null);
      setState("error");
      setMsg(typeof body?.detail === "string" ? body.detail : "That didn't go through. Try again in a minute.");
    } catch {
      setState("error");
      setMsg("That didn't go through. Check your connection and try again.");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="flex items-center gap-3 rounded-card border border-accent bg-accent-soft/50 px-4 py-3.5 text-sm font-medium text-accent-deep">
        <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs text-accent-ink">✓</span>
        {msg}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="w-full">
      <label htmlFor={`${id}-email`} className="sr-only">Work email</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          aria-invalid={state === "error" || undefined}
          aria-describedby={`${id}-msg`}
          className="min-h-12 min-w-0 flex-1 rounded-input border border-rule bg-paper px-4 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
        {/* Honeypot: hidden from people, bots fill it in. */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <button
          type="submit"
          disabled={state === "sending"}
          data-track="waitlist_click"
          className="min-h-12 cursor-pointer rounded-input bg-accent px-6 text-sm font-semibold text-accent-ink shadow-sm transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70"
        >
          {state === "sending" ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      <p id={`${id}-msg`} aria-live="polite" className={`mt-2 min-h-5 text-xs ${state === "error" ? "text-[oklch(50%_0.18_25)]" : "text-muted"}`}>
        {msg}
      </p>
    </form>
  );
}
