"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useRef } from "react";
import { PageHeader } from "@/components/ui/page";
import { api } from "@/lib/api";
import type { WebsiteChat } from "@/lib/website";
import { Conversations } from "./conversations";
import { WebsiteDocuments } from "./documents";
import { setUrl } from "./parts";
import { Setup } from "./setup";

// Website chat in three tabs (UI Phase 6): Setup, Website documents, Conversations. The tab lives in
// the URL (?tab=…) so a refresh or a shared link lands on the same tab. The document viewer keeps its
// own state here (not ?tab=chunks in the URL) so it never fights with this page's ?tab.

export const TABS = [
  { id: "setup", label: "Setup" },
  { id: "documents", label: "Website documents" },
  { id: "conversations", label: "Conversations" },
] as const;
export type Tab = (typeof TABS)[number]["id"];

export function Website() {
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = TABS.some((t) => t.id === raw) ? (raw as Tab) : "setup";
  const chat = useQuery({ queryKey: ["website-chat"], queryFn: () => api<WebsiteChat>("/website-chat") });
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const go = (t: Tab) => setUrl({ tab: t === "setup" ? null : t, chat: null });
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const next = (n + TABS.length) % TABS.length;
    go(TABS[next].id);
    refs.current[next]?.focus();
  };

  const c = chat.data;
  return (
    <div className="page site">
      <PageHeader
        title="Website chat"
        description="A chat bubble on your own website that answers visitors from the documents you choose, and nothing else."
        actions={c && (
          <span className="badge" data-tone={c.enabled ? "success" : undefined}>
            <span className="dot" aria-hidden="true" />{c.enabled ? "On" : "Off"}
          </span>
        )}
      />

      <div className="site-tabs" role="tablist" aria-label="Website chat sections">
        {TABS.map((t, i) => (
          <button key={t.id} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`tab-${t.id}`}
            aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
            onClick={() => go(t.id)} onKeyDown={(e) => onKey(e, i)}>
            {t.label}
            {t.id === "documents" && c && <span className="site-count">{c.public_documents}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="site-panel-body">
        {tab === "setup" && <Setup chat={chat} onTab={go} />}
        {tab === "documents" && <WebsiteDocuments />}
        {tab === "conversations" && <Conversations />}
      </div>
    </div>
  );
}
