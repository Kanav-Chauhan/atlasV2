"use client";

import { type UseQueryResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Region } from "@/components/region";
import { Card } from "@/components/ui/page";
import { api } from "@/lib/api";
import { HEX, snippet, type WebsiteChat } from "@/lib/website";
import { Switch } from "./parts";
import type { Tab } from "./website";

type Patch = Partial<Pick<WebsiteChat, "enabled" | "allowed_origins" | "greeting" | "accent" | "position">>;

export function Setup({ chat, onTab }: { chat: UseQueryResult<WebsiteChat>; onTab: (t: Tab) => void }) {
  const qc = useQueryClient();
  const [preview, setPreview] = useState(0); // bumps to reload the preview after a save
  const save = useMutation({
    mutationFn: (body: Patch) => api<WebsiteChat>("/website-chat", body, "PATCH"),
    onSuccess: (c) => { qc.setQueryData(["website-chat"], c); setPreview((n) => n + 1); },
  });

  return (
    <Region q={chat} what="website chat settings" rows={4} isEmpty={() => false} empty={null}>
      {(c) => (
        <div className="grid gap-[var(--page-gap)]">
          <ol className="site-steps" aria-label="How it works">
            <li>
              <span className="site-step-n" aria-hidden="true">1</span>
              <div>
                <h2>Choose what the bot may read</h2>
                <p>It answers only from documents you put on the website: now <strong>{c.public_documents}</strong>.</p>
                <button type="button" className="link" onClick={() => onTab("documents")}>Website documents</button>
              </div>
            </li>
            <li>
              <span className="site-step-n" aria-hidden="true">2</span>
              <div>
                <h2>Paste one line on your site</h2>
                <p>Copy the line below into your website, then add the site&apos;s address under Allowed websites.</p>
              </div>
            </li>
            <li>
              <span className="site-step-n" aria-hidden="true">3</span>
              <div>
                <h2>Read what visitors ask</h2>
                <p>Every chat is kept, with a flag when the answer wasn&apos;t in your documents.</p>
                <button type="button" className="link" onClick={() => onTab("conversations")}>Conversations</button>
              </div>
            </li>
          </ol>

          <div className="site-setup">
            <div className="grid content-start gap-[var(--page-gap)]">
              <Card>
                <div className="site-onoff">
                  <div className="min-w-0">
                    <h2 id="onoff-h" className="text-base font-semibold">Show the chat bubble on my website</h2>
                    <p className="text-sm text-muted">
                      {c.enabled ? "On: visitors on your allowed websites see the bubble." : "Off: visitors see nothing, and the line on your site does nothing."}
                    </p>
                  </div>
                  <Switch on={c.enabled} label="Show the chat bubble on my website" disabled={save.isPending}
                    onChange={(enabled) => save.mutate({ enabled })} />
                </div>
                {c.enabled && c.public_documents === 0 && (
                  <p className="site-note" data-tone="warn" role="status">
                    The bot has no documents to answer from yet, so it will say it doesn&apos;t know. <button type="button" className="link" onClick={() => onTab("documents")}>Add website documents</button>
                  </p>
                )}
              </Card>
              <Snippet c={c} onRotated={() => setPreview((n) => n + 1)} />
              <Settings key={`${c.accent}-${c.position}`} c={c} save={save} />
            </div>

            <Card title="Live preview" id="pv" note={c.enabled ? "What a visitor sees. Try a question." : "Chat is off: visitors see nothing."} className="site-preview">
              <iframe key={`${c.site_key}-${preview}`} src={`/embed/${c.site_key}?preview=1`} title="Website chat preview" />
            </Card>
          </div>
        </div>
      )}
    </Region>
  );
}

function Settings({ c, save }: { c: WebsiteChat; save: ReturnType<typeof useMutation<WebsiteChat, Error, Patch>> }) {
  const [accent, setAccent] = useState(c.accent);
  const [position, setPosition] = useState(c.position);
  return (
    <Card title="Look and where it works" id="st">
      <form className="grid gap-[var(--space-md)]" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save.mutate({
          greeting: String(f.get("greeting")).trim(),
          allowed_origins: String(f.get("origins")).split(/\s+/).map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean),
          accent, position,
        });
      }}>
        <label className="grid gap-1 text-sm font-medium">
          Allowed websites
          <textarea name="origins" rows={3} className="field py-2 font-mono" defaultValue={c.allowed_origins.join("\n")} placeholder="https://www.example.com" />
          <span className="font-normal text-muted">One address per line. The bubble only opens on these websites.</span>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Greeting
          <input name="greeting" className="field" defaultValue={c.greeting} maxLength={200} placeholder="Hi! Ask me anything about us." />
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
            {save.isError ? save.error.message : save.isSuccess ? "Saved. The preview shows the change." : ""}
          </p>
        </div>
      </form>
    </Card>
  );
}

function Snippet({ c, onRotated }: { c: WebsiteChat; onRotated: () => void }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rotate = useMutation({
    mutationFn: () => api<{ site_key: string }>("/website-chat/rotate-key", {}),
    onSuccess: ({ site_key }) => {
      qc.setQueryData<WebsiteChat>(["website-chat"], (old) => old && { ...old, site_key });
      setConfirming(false);
      onRotated();
    },
  });
  const line = snippet(c.site_key);
  const copy = () => navigator.clipboard.writeText(line).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });

  return (
    <Card title="Add it to your website" id="sn" note={<>Paste this line just before <code>&lt;/body&gt;</code> on every page.</>}>
      <div className="site-snippet">
        <code>{line}</code>
        <button type="button" className="btn" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <span className="sr-only" role="status">{copied ? "Snippet copied" : ""}</span>
      {confirming ? (
        <div className="site-note grid gap-2" data-tone="warn" role="alert">
          <p>The current line stops working at once. You will need to paste the new line on your website.</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={rotate.isPending} onClick={() => rotate.mutate()}>{rotate.isPending ? "Rotating" : "Rotate key"}</button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
          {rotate.error && <p className="text-error">{rotate.error.message}</p>}
        </div>
      ) : (
        <p className="text-sm text-muted">
          Someone copied the line to a site you don&apos;t own? <button type="button" className="link" onClick={() => setConfirming(true)}>Rotate key</button>
        </p>
      )}
    </Card>
  );
}
