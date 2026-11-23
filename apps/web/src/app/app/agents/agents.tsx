"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { Region } from "@/components/region";
import { Card, Page, PageHeader } from "@/components/ui/page";
import { api } from "@/lib/api";
import { day, type Person } from "@/lib/types";

type Token = {
  id: number; name: string; user: { id: number; name: string; email: string; avatar_url?: string | null };
  created_at: string; last_used_at: string | null; revoked: boolean;
};
type Created = { id: number; name: string; token: string };
type Audit = { at: string; token_name: string; user_email: string; tool: string; args_summary: string; ok: boolean; latency_ms: number };
type AuditPage = { items: Audit[]; total: number; page: number; per_page: number; tools: string[] };

const MCP_URL = "https://p1.kanav.space/api/mcp";
const PLACEHOLDER = "<your atl_ token>";
const PER_PAGE = 20;
const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const CLIENTS = [
  {
    id: "code", label: "Claude Code",
    where: "Run this once in a terminal. It adds Atlas to Claude Code for your user.",
    config: (t: string) => `claude mcp add --transport http --scope user atlas ${MCP_URL} \\\n  --header "Authorization: Bearer ${t}"`,
  },
  {
    id: "desktop", label: "Claude Desktop",
    where: "Claude Desktop: Settings, Developer, Edit config. Paste this, save, restart Claude. It connects through the mcp-remote bridge (needs Node.js).",
    config: (t: string) => JSON.stringify({ mcpServers: { atlas: { command: "npx", args: ["-y", "mcp-remote", MCP_URL, "--header", "Authorization:${ATLAS_TOKEN}"], env: { ATLAS_TOKEN: `Bearer ${t}` } } } }, null, 2),
  },
  {
    id: "any", label: "Any MCP client",
    where: "Cursor, VS Code and other clients that speak MCP over Streamable HTTP: use this server URL and header.",
    config: (t: string) => `Server URL:  ${MCP_URL}\nTransport:   Streamable HTTP\nHeader:      Authorization: Bearer ${t}`,
  },
];

const PROMPTS = [
  "Use Atlas to find our leave policy and tell me how many days of earned leave I get, with sources.",
  "Search Atlas for the travel reimbursement rules and summarise them in 5 bullet points.",
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
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<Created | null>(null); // the secret, kept only in this tab's memory
  const [showRevoked, setShowRevoked] = useState(false);
  const [err, setErr] = useState("");
  const refresh = () => ["tokens", "tokens-audit"].forEach((k) => client.invalidateQueries({ queryKey: [k] }));

  async function revoke(t: Token) {
    if (!confirm(`Revoke ${t.name}? Agents using it stop working at once.`)) return;
    setErr("");
    try {
      await api(`/tokens/${t.id}`, undefined, "DELETE");
      if (fresh?.id === t.id) setFresh(null);
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <Page>
      <PageHeader title="Agent access"
        description="AI agents like Claude connect to Atlas with a token. Each token acts as one person and reads only what that person can."
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>Create token</button>} />
      {err && <p className="state text-sm text-error" role="alert">{err}</p>}

      <Setup fresh={fresh} hasTokens={(tokens.data ?? []).some((t) => !t.revoked)} onCreate={() => setCreating(true)} />

      <Card id="tok" title="Tokens" note="Revoke a token the moment it is not needed."
        action={(tokens.data ?? []).some((t) => t.revoked) ? (
          <button type="button" className="btn" aria-pressed={showRevoked} onClick={() => setShowRevoked((v) => !v)}>
            {showRevoked ? "Hide revoked" : `Show revoked (${(tokens.data ?? []).filter((t) => t.revoked).length})`}
          </button>
        ) : undefined}>
        <Region q={tokens} what="tokens" rows={2} isEmpty={(l) => !l.some((t) => showRevoked || !t.revoked)}
          empty={<><p className="font-semibold">No active tokens</p><p className="text-sm text-muted">Create one to let an agent search Atlas as a person.</p>
            <button type="button" className="btn" onClick={() => setCreating(true)}>Create token</button></>}>
          {(list) => (
            <ul className="tok-cards">
              {list.filter((t) => showRevoked || !t.revoked).map((t) => (
                <li key={t.id} className="tok-card" data-revoked={t.revoked || undefined}>
                  <div className="tok-card-head">
                    <strong className="tok-name">{t.name}</strong>
                    {t.revoked ? <span className="badge">Revoked</span>
                      : t.last_used_at ? <span className="badge" data-tone="success"><span className="dot" />In use</span>
                      : <span className="badge" data-tone="info"><span className="dot" />Not used yet</span>}
                  </div>
                  <div className="person">
                    <Avatar name={t.user.name} url={t.user.avatar_url} />
                    <div><strong>Acts as {t.user.name}</strong><span>{t.user.email}</span></div>
                  </div>
                  <dl className="tok-dates">
                    <div><dt>Created</dt><dd>{day.format(new Date(t.created_at))}</dd></div>
                    <div><dt>Last used</dt><dd>{t.last_used_at ? when.format(new Date(t.last_used_at)) : "Not yet"}</dd></div>
                  </dl>
                  {!t.revoked && (
                    <button type="button" className="btn tok-revoke" onClick={() => revoke(t)}>Revoke<span className="sr-only"> {t.name}</span></button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Region>
      </Card>

      <AuditLog tokens={tokens.data ?? []} />

      {creating && <CreateDialog onCreated={(c) => { setFresh(c); refresh(); }} onClose={() => setCreating(false)} />}
    </Page>
  );
}

// ------------------------------------------------------------------ 3-step setup

function Setup({ fresh, hasTokens, onCreate }: { fresh: Created | null; hasTokens: boolean; onCreate: () => void }) {
  const [tab, setTab] = useState(CLIENTS[0].id);
  const { copied, copy } = useCopy();
  const c = CLIENTS.find((x) => x.id === tab) ?? CLIENTS[0];
  const text = c.config(fresh?.token ?? PLACEHOLDER);
  const step1Done = Boolean(fresh) || hasTokens;
  return (
    <Card id="setup" title="Connect an agent in 3 steps" note="Works with Claude Code, Claude Desktop and any MCP client.">
      <ol className="steps">
        <li className="step" data-done={step1Done || undefined}>
          <span className="step-n" aria-hidden="true">1</span>
          <div className="step-body">
            <h3>Create a token</h3>
            {fresh ? (
              <p className="text-sm text-ink-2">Token <strong>{fresh.name}</strong> is ready. It is filled into the config below for as long as this page is open.</p>
            ) : (
              <p className="text-sm text-muted">Choose the person the agent acts as. The agent reads exactly what that person can read.</p>
            )}
            {!fresh && <div><button type="button" className="btn" onClick={onCreate}>Create token</button></div>}
          </div>
        </li>
        <li className="step">
          <span className="step-n" aria-hidden="true">2</span>
          <div className="step-body">
            <h3>Add Atlas to your agent</h3>
            <div className="seg" role="group" aria-label="Agent">
              {CLIENTS.map((x) => (
                <button key={x.id} type="button" aria-pressed={tab === x.id} onClick={() => setTab(x.id)}>{x.label}</button>
              ))}
            </div>
            <div className="grid gap-2">
              <p className="text-sm text-ink-2">{c.where}</p>
              <div className="tok-code">
                <pre><code>{text}</code></pre>
                <button type="button" className="btn" onClick={() => copy(c.id, text)}>{copied === c.id ? "Copied" : "Copy"}</button>
              </div>
              {!fresh && <p className="text-xs text-muted">Replace <code>{PLACEHOLDER}</code> with your token.</p>}
            </div>
          </div>
        </li>
        <li className="step">
          <span className="step-n" aria-hidden="true">3</span>
          <div className="step-body">
            <h3>Test it</h3>
            <p className="text-sm text-muted">Ask your agent one of these. The call shows up in the activity log below within seconds.</p>
            <ul className="tok-prompts">
              {PROMPTS.map((p, i) => (
                <li key={p}>
                  <span>{p}</span>
                  <button type="button" className="btn" onClick={() => copy(`p${i}`, p)}>{copied === `p${i}` ? "Copied" : "Copy"}</button>
                </li>
              ))}
            </ul>
          </div>
        </li>
      </ol>
      <span className="sr-only" role="status">{copied ? "Copied" : ""}</span>
    </Card>
  );
}

// ------------------------------------------------------------------ audit log

function AuditLog({ tokens }: { tokens: Token[] }) {
  const [token, setToken] = useState("");
  const [tool, setTool] = useState("");
  const [days, setDays] = useState("7");
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ days, page: String(page), per_page: String(PER_PAGE) });
  if (token) qs.set("token", token);
  if (tool) qs.set("tool", tool);
  const audit = useQuery({
    queryKey: ["tokens-audit", days, token, tool, page],
    queryFn: () => api<AuditPage>(`/tokens/audit?${qs}`),
    placeholderData: keepPreviousData,
  });
  const filter = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => { set(e.target.value); setPage(1); };
  const d = audit.data;
  const pages = d ? Math.max(1, Math.ceil(d.total / d.per_page)) : 1;

  return (
    <Card id="aud" title="What agents did" note="Every tool call, newest first.">
      <div className="aud-filters">
        <label>Token
          <select className="field" value={token} onChange={filter(setToken)}>
            <option value="">All tokens</option>
            {tokens.map((t) => <option key={t.id} value={t.id}>{t.name}{t.revoked ? " (revoked)" : ""}</option>)}
          </select>
        </label>
        <label>Tool
          <select className="field" value={tool} onChange={filter(setTool)}>
            <option value="">All tools</option>
            {(d?.tools ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Period
          <select className="field" value={days} onChange={filter(setDays)}>
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
      </div>
      <Region q={audit} what="activity log" rows={4} isEmpty={(p) => p.items.length === 0}
        empty={<><p className="font-semibold">No agent activity {token || tool ? "for these filters" : "in this period"}</p><p className="text-sm text-muted">Calls appear here as soon as an agent uses a token.</p></>}>
        {(p) => (
          <>
            <div className="table-wrap" aria-busy={audit.isFetching}>
              <table className="tbl">
                <thead><tr><th scope="col">When</th><th scope="col">Tool</th><th scope="col" className="hide-sm">Token</th><th scope="col">Asked</th><th scope="col" className="num">Result</th></tr></thead>
                <tbody>
                  {p.items.map((a, i) => (
                    <tr key={`${a.at}-${i}`}>
                      <td className="whitespace-nowrap text-muted">{when.format(new Date(a.at))}</td>
                      <td><code className="tok-tool">{a.tool}</code></td>
                      <td className="hide-sm"><span className="grid"><span>{a.token_name}</span><span className="text-xs text-muted">{a.user_email}</span></span></td>
                      <td className="tok-args">{a.args_summary || "No input"}</td>
                      <td className="num whitespace-nowrap">{a.ok ? <span className="badge" data-tone="success">Done</span> : <span className="badge" data-tone="error">Failed</span>}<span className="block text-xs text-muted">{a.latency_ms} ms</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="aud-pages" aria-label="Activity pages">
              <p className="text-sm text-muted">{(p.page - 1) * p.per_page + 1}–{(p.page - 1) * p.per_page + p.items.length} of {p.total}</p>
              <div className="flex gap-2">
                <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                <button type="button" className="btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </nav>
          </>
        )}
      </Region>
    </Card>
  );
}

// ------------------------------------------------------------------ create

// Opens as a modal on mount; closing (Esc, Cancel, Done) unmounts it.
const openModal = (d: HTMLDialogElement | null) => { if (d && !d.open) d.showModal(); };

function CreateDialog({ onCreated, onClose }: { onCreated: (c: Created) => void; onClose: () => void }) {
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
      const c = await api<Created>("/tokens", { name: String(f.get("name")).trim(), user_id: Number(f.get("user_id")) });
      setCreated(c);
      onCreated(c);
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
          <p className="text-sm text-ink-2">This is the only time you will see it. Atlas keeps only a fingerprint, so a lost token can&apos;t be shown again; revoke it and make a new one. Step 2 on this page now has it filled in.</p>
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
