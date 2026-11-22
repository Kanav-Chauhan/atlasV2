"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import "../app/controls.css";

// Atlas owner login: POST /api/auth/super sets the signed atlas_super cookie, then /super.
export function OwnerForm() {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr("");
    try {
      await api("/auth/super", { email: String(f.get("email")).trim(), password: String(f.get("password")) });
      router.push("/super");
    } catch (e) {
      setErr((e as { status?: number }).status === 401 ? "That email and password don't match." : (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-card border border-rule bg-paper p-4" onSubmit={submit}>
      <label className="grid gap-1 text-sm font-medium">
        Email
        <input name="email" type="email" required defaultValue="sa@kanav.space" autoComplete="username" className="field" />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Password
        <input name="password" type="password" required autoComplete="current-password" className="field" autoFocus />
      </label>
      {err && <p className="text-sm text-error" role="alert">{err}</p>}
      <button type="submit" className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Checking" : "Log in"}</button>
    </form>
  );
}
