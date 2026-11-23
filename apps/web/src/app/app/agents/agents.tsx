"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Region } from "@/components/region";
import { api } from "@/lib/api";
import { initials } from "@/lib/demo-users";
import { day, type Person } from "@/lib/types";

type Token = {
  id: number; name: string; user: { id: number; name: string; email: string };
  created_at: string; last_used_at: string | null; revoked: boolean;
};
type Created = { id: number; name: string; token: string };
type Audit = { at: string; token_name: string; user_email: string; tool: string; args_summary: string; ok: boolean; latency_ms: number };

const MCP_URL = "https://p1.kanav.space/api/mcp";
const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const SETUPS = [
  {
    id: "code", label: "Claude Code", where: "Save as .mcp.json in your project, or run claude mcp add with the same URL and header.",
    config: { mcpServers: { atlas: { type: "http", url: MCP_URL, headers: { Authorization: "Bearer <your atl_ token>" } } } },
  },
  {
    id: "desktop", label: "Claude Desktop", where: "Settings, Developer, Edit config. It connects through the mcp-remote bridge (needs Node).",
    config: { mcpServers: { atlas: { command: "npx", args: ["-y", "mcp-remote", MCP_URL, "--header", "Authorization:${ATLAS_TOKEN}"], env: { ATLAS_TOKEN: "Bearer <your atl_ token>" } } } },
  },
];

function useCopy() {
  const [copied, setCopied] = useState("");
  const copy = (key: string, value: string) =>
    navigator.clipboard.writeText(value).then(() => { setCopied(key); setTimeout(() => setCopied(""), 1500); }, () => setCopied(""));
  return { copied, copy };
}

export function Agents() {
  const client = useQueryClient();
  const tokens = useQuery({ queryKey: ["tokens"], queryFn: () => api<Token[]>("/tokens") });
  const audit = useQuery({ queryKey: ["tokens-audit"], queryFn: () => api<Audit[]>("/tokens/audit?days=7") });
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const refresh = () => ["tokens", "tokens-audit"].forEach((k) => client.invalidateQueries({ queryKey: [k] }));

  async function revoke(t: Token) {
    if (!confirm(`Revoke ${t.name}? Agents using it stop working at once.`)) return;
    setErr("");
    try {
      await api(`/tokens/${t.id}`, undefined, "DELETE");
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-[var(--gutter)] py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold">Agent access</h1>
          <p className="max-w-[60ch] text-muted">AI agents like Claude connect to Atlas with a token. Each token acts as one person and reads only what that person can.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>Create token</button>
      </header>
      {err && <p className="state text-sm text-error" role="alert">{err}</p>}

      <section className="block" aria-labelledby="tok-h">
        <div className="block-head"><div>
          <h2 id="tok-h">Tokens</h2>
          <p>Revoke a token the moment it is not needed.</p>
        </div></div>
        <Region q={tokens} what="tokens" rows={3}
          empty={<><p className="font-semibold">No tokens yet</p><p className="text-sm text-muted">Create one to let an agent search Atlas as a person.</p>
            <button type="button" className="btn" onClick={() => setCreating(true)}>Create token</button></>}>
          {(list) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th scope="col">Name</th><th scope="col">Acts as</th><th scope="col" className="hide-sm">Created</th><th scope="col" className="hide-sm">Last used</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {list.map((t) => (
                    <tr key={t.id} className={t.revoked ? "tok-revoked" : undefined}>
                      <td><strong>{t.name}</strong>{t.revoked && <span className="block text-xs text-muted">Revoked</span>}</td>
                      <td><div className="person"><span className="avatar" aria-hidden="true">{initials(t.user.name)}</span><div><strong>{t.user.name}</strong><span>{t.user.email}</span></div></div></td>
                      <td className="hide-sm text-muted">{day.format(new Date(t.created_at))}</td>
                      <td className="hide-sm text-muted">{t.last_used_at ? when.format(new Date(t.last_used_at)) : "Not yet"}</td>
                      <td>{!t.revoked && (
                        <div className="row-actions"><button type="button" className="btn" onClick={() => revoke(t)}>Revoke<span className="sr-only"> {t.name}</span></button></div>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Region>
      </section>

      <Setup />

      <section className="block" aria-labelledby="aud-h">
        <div className="block-head"><div>
          <h2 id="aud-h">What agents did</h2>
          <p>Every tool call in the last 7 days, newest first.</p>
        </div></div>
        <Region q={audit} what="activity log" rows={4}
          empty={<><p className="font-semibold">No agent activity yet</p><p className="text-sm text-muted">Calls appear here as soon as an agent uses a token.</p></>}>
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th scope="col">Tool</th><th scope="col" className="hide-sm">Token</th><th scope="col">Asked</th><th scope="col" className="num">Result</th></tr></thead>
                <tbody>
                  {rows.map((a, i) => (
                    <tr key={`${a.at}-${i}`}>
                      <td><code className="tok-tool">{a.tool}</code><span className="block whitespace-nowrap text-xs text-muted">{when.format(new Date(a.at))}</span></td>
                      <td className="hide-sm"><span className="grid"><span>{a.token_name}</span><span className="text-xs text-muted">{a.user_email}</span></span></td>
                      <td className="tok-args">{a.args_summary || "No input"}</td>
                      <td className="num whitespace-nowrap">{a.ok ? <span className="yes">Done</span> : <span className="tok-fail">Failed</span>}<span className="block text-xs text-muted">{a.latency_ms} ms</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Region>
      </section>

      {creating && <CreateDialog onDone={refresh} onClose={() => setCreating(false)} />}
    </div>
  );
}

function Setup() {
  const [tab, setTab] = useState(SETUPS[0].id);
  const { copied, copy } = useCopy();
  const s = SETUPS.find((x) => x.id === tab) ?? SETUPS[0];
  const json = JSON.stringify(s.config, null, 2);
  return (
    <section className="block" aria-labelledby="set-h">
      <div className="block-head">
        <div>
          <h2 id="set-h">Connect an agent</h2>
          <p>Replace the placeholder with a token. The server URL is <code>{MCP_URL}</code>.</p>
        </div>
        <div className="seg" role="group" aria-label="Agent">
          {SETUPS.map((x) => <button key={x.id} type="button" aria-pressed={tab === x.id} onClick={() => setTab(x.id)}>{x.label}</button>)}
        </div>
      </div>
      <p className="text-sm text-ink-2">{s.where}</p>
      <div className="tok-code">
        <pre><code>{json}</code></pre>
        <button type="button" className="btn" onClick={() => copy(s.id, json)}>{copied === s.id ? "Copied" : "Copy"}</button>
      </div>
      <span className="sr-only" role="status">{copied === s.id ? "Config copied" : ""}</span>
    </section>
  );
}

// Opens as a modal on mount; closing (Esc, Cancel, Done) unmounts it.
const openModal = (d: HTMLDialogElement | null) => { if (d && !d.open) d.showModal(); };

function CreateDialog({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const team = useQuery({ queryKey: ["team"], queryFn: () => api<Person[]>("/team") });
  const [created, setCreated] = useState<Created | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { copied, copy } = useCopy();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr("");
    try {
      setCreated(await api<Created>("/tokens", { name: String(f.get("name")).trim(), user_id: Number(f.get("user_id")) }));
      onDone();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={openModal} className="dialog" aria-labelledby="ct-title" onClose={onClose}>
      {created ? (
        <div className="grid gap-4">
          <h2 id="ct-title" className="text-xl font-semibold">Copy your token</h2>
          <p className="text-sm text-ink-2">This is the only time you will see it. Atlas keeps only a fingerprint, so a lost token can&apos;t be shown again; revoke it and make a new one.</p>
          <div className="tok-code">
            <code className="tok-secret">{created.token}</code>
            <button type="button" className="btn" onClick={() => copy("secret", created.token)}>{copied === "secret" ? "Copied" : "Copy"}</button>
          </div>
          <span className="sr-only" role="status">{copied === "secret" ? "Token copied" : ""}</span>
          <div className="flex justify-end"><button type="button" className="btn btn-primary" onClick={onClose}>Done</button></div>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={submit}>
          <h2 id="ct-title" className="text-xl font-semibold">Create a token</h2>
          <label className="grid gap-1 text-sm font-medium">Name<input name="name" required maxLength={100} className="field" placeholder="Priya's Claude Desktop" autoComplete="off" /></label>
          <label className="grid gap-1 text-sm font-medium">
            Acts as
            {team.isError ? <span className="text-sm text-error">The team list didn&apos;t load. Close and try again.</span> : (
              <select name="user_id" required className="field" disabled={team.isPending} defaultValue="">
                <option value="" disabled>{team.isPending ? "Loading people" : "Choose a person"}</option>
                {(team.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
              </select>
            )}
            <span className="text-xs font-normal text-muted">The agent reads exactly what this person can read.</span>
          </label>
          {err && <p className="text-sm text-error" role="alert">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || !team.data}>{busy ? "Creating" : "Create token"}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
