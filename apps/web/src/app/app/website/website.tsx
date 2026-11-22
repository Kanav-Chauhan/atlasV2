"use client";

import { type UseMutationResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type AtlasMessage, Markdown, metaOf, sourcesOf, textOf } from "@/app/app/ask/ask";
import { Region } from "@/components/region";
import { api } from "@/lib/api";
import { day } from "@/lib/types";
import { HEX, snippet, type VisitorChat, type WebsiteChat } from "@/lib/website";

type Doc = { id: number; title: string; access: string; is_public: boolean; status: string };
type Patch = Partial<Pick<WebsiteChat, "enabled" | "allowed_origins" | "greeting" | "accent" | "position">>;

const time = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function Website() {
  const qc = useQueryClient();
  const chat = useQuery({ queryKey: ["website-chat"], queryFn: () => api<WebsiteChat>("/website-chat") });
  const [preview, setPreview] = useState(0); // bumps to reload the preview after a save
  const save = useMutation({
    mutationFn: (body: Patch) => api<WebsiteChat>("/website-chat", body, "PATCH"),
    onSuccess: (c) => { qc.setQueryData(["website-chat"], c); setPreview((n) => n + 1); },
  });

  return (
    <div className="site-page mx-auto grid max-w-6xl gap-10 px-[var(--gutter)] py-10">
      <header className="grid gap-1">
        <h1 className="text-3xl font-semibold">Website chat</h1>
        <p className="text-muted">A chat bubble on your website that answers visitors from public documents only.</p>
      </header>

      <Region q={chat} what="website chat settings" rows={4} isEmpty={() => false} empty={null}>
        {(c) => (
          <div className="site-top">
            <div className="grid content-start gap-8">
              <Settings c={c} save={save} />
              <Snippet c={c} onRotated={() => setPreview((n) => n + 1)} />
            </div>
            <section className="block site-preview" aria-labelledby="pv-title">
              <div className="block-head">
                <h2 id="pv-title">Live preview</h2>
                <p>{c.enabled ? "What a visitor sees" : "Chat is off: visitors see nothing"}</p>
              </div>
              <iframe key={`${c.site_key}-${preview}`} src={`/embed/${c.site_key}?preview=1`} title="Website chat preview" />
            </section>
          </div>
        )}
      </Region>

      <div className="two-col">
        <PublicDocs />
        <Conversations />
      </div>
    </div>
  );
}

function Settings({ c, save }: { c: WebsiteChat; save: UseMutationResult<WebsiteChat, Error, Patch> }) {
  const [accent, setAccent] = useState(c.accent);
  const [position, setPosition] = useState(c.position);
  return (
    <form className="block" aria-labelledby="st-title" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      save.mutate({
        enabled: f.get("enabled") === "on",
        greeting: String(f.get("greeting")).trim(),
        allowed_origins: String(f.get("origins")).split(/\s+/).map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean),
        accent, position,
      });
    }}>
      <div className="block-head"><h2 id="st-title">Settings</h2></div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input name="enabled" type="checkbox" defaultChecked={c.enabled} className="size-4 accent-accent" />
        Show the chat bubble on my website
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Allowed websites
        <textarea name="origins" rows={3} className="field py-2 font-mono" defaultValue={c.allowed_origins.join("\n")} placeholder="https://www.example.com" />
        <span className="font-normal text-muted">One address per line. The bubble only opens on these websites.</span>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Greeting<input name="greeting" className="field" defaultValue={c.greeting} maxLength={200} placeholder="Hi! Ask me anything about us." />
      </label>
      <div className="flex flex-wrap items-end gap-6">
        <label className="grid gap-1 text-sm font-medium">
          Colour
          <span className="flex items-center gap-2">
            <input type="color" className="site-swatch" value={HEX.test(accent) ? accent : "#000000"} onChange={(e) => setAccent(e.target.value)} aria-label="Pick a colour" />
            <input className="field w-28 font-mono" value={accent} onChange={(e) => setAccent(e.target.value)} pattern="#[0-9a-fA-F]{6}" aria-label="Colour code" />
          </span>
        </label>
        <fieldset className="grid gap-1">
          <legend className="mb-1 text-sm font-medium">Bubble position</legend>
          <div className="seg">
            {(["left", "right"] as const).map((p) => (
              <button key={p} type="button" aria-pressed={position === p} onClick={() => setPosition(p)}>{p === "left" ? "Bottom left" : "Bottom right"}</button>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Saving" : "Save"}</button>
        <p role="status" className={`text-sm ${save.isError ? "text-error" : "text-muted"}`}>
          {save.isError ? save.error.message : save.isSuccess ? "Saved." : ""}
        </p>
      </div>
    </form>
  );
}

function Snippet({ c, onRotated }: { c: WebsiteChat; onRotated: () => void }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rotate = useMutation({
    mutationFn: async () => {
      const r = await api<{ site_key: string } | string>("/website-chat/rotate-key", {});
      return typeof r === "string" ? r : r.site_key;
    },
    onSuccess: (site_key) => {
      qc.setQueryData<WebsiteChat>(["website-chat"], (old) => old && { ...old, site_key });
      setConfirming(false);
      onRotated();
    },
  });
  const line = snippet(c.site_key);
  const copy = () => navigator.clipboard.writeText(line).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });

  return (
    <section className="block" aria-labelledby="sn-title">
      <div className="block-head">
        <h2 id="sn-title">Add it to your website</h2>
        <p>Paste this line just before <code>&lt;/body&gt;</code> on every page.</p>
      </div>
      <div className="site-snippet">
        <code>{line}</code>
        <button type="button" className="btn" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <span className="sr-only" role="status">{copied ? "Snippet copied" : ""}</span>
      {confirming ? (
        <div className="site-confirm" role="alert">
          <p className="text-sm">The current line stops working at once. You will need to paste the new line on your website.</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={rotate.isPending} onClick={() => rotate.mutate()}>{rotate.isPending ? "Rotating" : "Rotate key"}</button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
          {rotate.error && <p className="text-sm text-error">{rotate.error.message}</p>}
        </div>
      ) : (
        <button type="button" className="btn justify-self-start" onClick={() => setConfirming(true)}>Rotate key</button>
      )}
    </section>
  );
}

function PublicDocs() {
  const qc = useQueryClient();
  const [all, setAll] = useState(false);
  const docs = useQuery({ queryKey: ["documents"], queryFn: () => api<Doc[]>("/documents") });
  const toggle = useMutation({
    mutationFn: (d: Doc) => api<Doc>(`/documents/${d.id}`, { is_public: !d.is_public }, "PATCH"),
    onSuccess: (doc) => qc.setQueryData<Doc[]>(["documents"], (old) => old?.map((d) => (d.id === doc.id ? { ...d, is_public: doc.is_public } : d))),
  });
  const shown = (list: Doc[]) => (all ? list : list.filter((d) => d.is_public));

  return (
    <section className="block" aria-labelledby="pd-title">
      <div className="block-head">
        <h2 id="pd-title">Public documents</h2>
        <div className="seg">
          <button type="button" aria-pressed={!all} onClick={() => setAll(false)}>On website</button>
          <button type="button" aria-pressed={all} onClick={() => setAll(true)}>All documents</button>
        </div>
      </div>
      <p className="text-sm text-muted">Visitors get answers from these documents only. Staff documents are never shown.</p>
      <Region q={docs} what="documents" isEmpty={(d) => shown(d).length === 0}
        empty={<><p className="text-sm font-semibold">No public documents yet</p><p className="text-sm text-muted">Pick &ldquo;All documents&rdquo; and switch on the ones visitors may read.</p></>}>
        {(d) => (
          <ul className="list site-docs">
            {shown(d).map((doc) => (
              <li key={doc.id}>
                <span className="min-w-0">{doc.title}<small>{doc.access}</small></span>
                <label className="flex flex-none items-center gap-2 text-sm">
                  <input type="checkbox" role="switch" className="size-4 accent-accent" checked={doc.is_public}
                    disabled={toggle.isPending && toggle.variables?.id === doc.id} onChange={() => toggle.mutate(doc)} />
                  Show on website
                </label>
              </li>
            ))}
          </ul>
        )}
      </Region>
      {toggle.error && <p className="text-sm text-error" role="alert">{toggle.error.message}</p>}
    </section>
  );
}

function Conversations() {
  const [open, setOpen] = useState<VisitorChat | null>(null);
  const list = useQuery({ queryKey: ["visitor-chats"], queryFn: () => api<VisitorChat[]>("/website-chat/conversations?days=30") });
  return (
    <section className="block" aria-labelledby="vc-title">
      <div className="block-head">
        <h2 id="vc-title">Visitor conversations</h2>
        <p>Last 30 days</p>
      </div>
      <Region q={list} what="visitor conversations"
        empty={<><p className="text-sm font-semibold">No visitor conversations yet</p><p className="text-sm text-muted">When someone uses the bubble on your website, the chat shows up here.</p></>}>
        {(rows) => (
          <ul className="list">
            {rows.map((r) => (
              <li key={r.id} className="stack">
                <button type="button" className="site-row" onClick={() => setOpen(r)}>
                  <span>{r.last_question}</span>
                  <small>
                    {time.format(new Date(r.started_at))}, {r.messages} {r.messages === 1 ? "message" : "messages"}{r.origin ? `, ${r.origin.replace(/^https?:\/\//, "")}` : ""}
                    {r.not_found && <span className="tag tag-warn ml-2">Not found</span>}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Region>
      {open && <Drawer chat={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

const openModal = (d: HTMLDialogElement | null) => { if (d && !d.open) d.showModal(); };

function Drawer({ chat, onClose }: { chat: VisitorChat; onClose: () => void }) {
  const msgs = useQuery({
    queryKey: ["visitor-chat", chat.id],
    queryFn: async () => {
      const d = await api<AtlasMessage[] | { messages: AtlasMessage[] }>(`/website-chat/conversations/${chat.id}`);
      return Array.isArray(d) ? d : d.messages;
    },
  });
  return (
    <dialog ref={openModal} className="site-drawer" aria-labelledby="dr-title" onClose={onClose}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id="dr-title" className="text-lg font-semibold">Visitor conversation</h2>
          <p className="text-sm text-muted">{day.format(new Date(chat.started_at))}{chat.origin ? `, from ${chat.origin}` : ""}</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>
      <Region q={msgs} what="conversation" empty={<p className="text-sm text-muted">This conversation has no messages.</p>}>
        {(ms) => (
          <div className="grid gap-4 text-sm">
            {ms.map((m) => m.role === "user" ? <p key={m.id} className="q">{textOf(m)}</p> : metaOf(m)?.abstained ? (
              <div key={m.id} className="notfound"><strong>Not found in public documents</strong></div>
            ) : (
              <div key={m.id} className="a">
                <Markdown text={textOf(m)} sources={sourcesOf(m)} live={false} current={null} />
                {sourcesOf(m).length > 0 && <p className="text-xs text-muted">Sources: {sourcesOf(m).map((s) => s.title).join("; ")}</p>}
              </div>
            ))}
          </div>
        )}
      </Region>
    </dialog>
  );
}
