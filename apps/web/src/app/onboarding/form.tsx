"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import "../app/controls.css";

export function OnboardingForm({ name }: { name: string }) {
  const router = useRouter();
  const { signOut } = useClerk();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr("");
    try {
      await api("/onboarding", { company: String(f.get("company")).trim(), industry: String(f.get("industry")).trim() });
      router.replace("/app");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <form className="grid gap-4 rounded-card border border-rule bg-paper p-4" onSubmit={submit}>
        <p className="text-sm text-muted">
          {name ? `Welcome, ${name}. ` : ""}You&apos;ll be the Admin of this company in Atlas: add documents, then invite your team.
        </p>
        <label className="grid gap-1 text-sm font-medium">
          Company name
          <input name="company" required minLength={2} maxLength={200} autoComplete="organization" className="field" autoFocus />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Industry <span className="font-normal text-muted">Optional, for example “IT services” or “Hospital”</span>
          <input name="industry" maxLength={200} className="field" />
        </label>
        {err && <p className="text-sm text-error" role="alert">{err}</p>}
        <button type="submit" className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Setting up" : "Create company"}</button>
      </form>
      <p className="mt-2 text-xs text-muted">
        Invited by a colleague? Sign in with the email the invitation went to.{" "}
        <button type="button" className="cursor-pointer underline" onClick={() => signOut({ redirectUrl: "/login?tab=signin" })}>Use another account</button>
      </p>
    </>
  );
}
