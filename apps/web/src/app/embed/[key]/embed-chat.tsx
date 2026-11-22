"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId } from "ai";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type AtlasMessage, errorText, Markdown, metaOf, sourcesOf, STAGE_TEXT, type Stage, textOf } from "@/app/app/ask/ask";
import { HEX, inkOn, type PublicConfig } from "@/lib/website";

// The visitor's thread lives only in this tab (the API keeps it 24 h). Storage can be blocked inside iframes.
function threadId(key: string) {
  if (typeof window === "undefined") return "";
  const k = `atlas-thread-${key}`;
  try {
    const id = sessionStorage.getItem(k) ?? generateId();
    sessionStorage.setItem(k, id);
    return id;
  } catch {
    return generateId();
  }
}

const close = () => window.parent.postMessage("atlas:close", "*");

export function EmbedChat({ siteKey, config, preview }: { siteKey: string; config: PublicConfig; preview: boolean }) {
  const [id] = useState(() => threadId(siteKey));
  const [transport] = useState(() => new DefaultChatTransport<AtlasMessage>({ api: `/api/public/${siteKey}/chat` }));
  const [stage, setStage] = useState<Stage | null>(null);
  const [input, setInput] = useState("");
  const honeypot = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const framed = useSyncExternalStore(() => () => {}, () => !preview && window.parent !== window, () => false);

  const { messages, sendMessage, status, stop, error, regenerate } = useChat<AtlasMessage>({
    id, transport,
    onData: (p) => { if (p.type === "data-status") setStage(p.data.stage); },
    onFinish: () => setStage(null),
    onError: () => setStage(null),
  });
  const busy = status === "submitted" || status === "streaming";
  const last = messages.at(-1);

  const ask = () => {
    const text = input.trim();
    if (!text || busy) return;
    setStage(null);
    sendMessage({ text }, { body: { website: honeypot.current?.value ?? "" } });
    setInput("");
  };

  useEffect(() => {
    const el = scroller.current;
    if (el && (status === "submitted" || el.scrollHeight - el.scrollTop - el.clientHeight < 120)) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    if (!framed) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [framed]);

  const accent = HEX.test(config.accent) ? config.accent : null;
  const style = accent ? ({ "--site-accent": accent, "--site-ink": inkOn(accent) } as React.CSSProperties) : undefined;

  return (
    <main className="embed" style={style}>
      <header className="embed-head">
        <div>
          <h1>{config.company}</h1>
          <p>Answers from our public documents</p>
        </div>
        {framed && (
          <button type="button" className="icon-btn" aria-label="Close chat" onClick={close}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </header>

      <div className="embed-thread" ref={scroller} aria-live="polite">
        <p className="embed-greet">{config.greeting || `Hi! Ask me anything about ${config.company}.`}</p>
        {messages.map((m, i) => m.role === "user" ? <p key={m.id} className="q">{textOf(m)}</p>
          : <Reply key={m.id} m={m} live={busy && i === messages.length - 1} company={config.company} />)}
        {busy && (last?.role === "user" || !textOf(last!)) && (
          <p className="status" role="status"><span className="pulse" aria-hidden="true" />{STAGE_TEXT[stage ?? "guard"].replace("your documents", "our documents")}</p>
        )}
        {error && (
          <div className="notfound" role="alert">
            <strong>That didn&apos;t go through</strong>
            <p>{errorText(error)}</p>
            <button type="button" className="btn" onClick={() => regenerate()}>Try again</button>
          </div>
        )}
      </div>

      <form className="embed-composer" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        {/* Honeypot: people never see or fill it; bots that fill every field are turned away by the API. */}
        <div className="embed-hp" aria-hidden="true">
          <label>Website<input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <label className="sr-only" htmlFor="embed-q">Your question</label>
        <textarea id="embed-q" rows={1} maxLength={500} value={input} placeholder="Type your question" autoComplete="off" autoFocus
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(); } }} />
        {busy
          ? <button type="button" className="btn" onClick={() => stop()}>Stop</button>
          : <button type="submit" className="btn embed-send" disabled={!input.trim()}>Send</button>}
      </form>
      {config.show_badge && (
        <a className="embed-badge" href="https://p10.kanav.space" target="_blank" rel="noopener">Powered by Atlas</a>
      )}
    </main>
  );
}

function Reply({ m, live, company }: { m: AtlasMessage; live: boolean; company: string }) {
  const text = textOf(m);
  const sources = sourcesOf(m);
  if (metaOf(m)?.abstained) return (
    <div className="notfound" role="status">
      <strong>Not found in our public documents</strong>
      <p>{text.replace(/^\s*Not found in your documents\.?\s*/i, "") || `${company} hasn't published an answer to this. Try asking another way, or contact ${company} directly.`}</p>
    </div>
  );
  if (!text && live) return null;
  return (
    <div className="a">
      <Markdown text={text} sources={sources} live={live} current={null} />
      {sources.length > 0 && (
        <p className="embed-sources">
          <span>Sources:</span>
          {sources.map((s) => <span key={s.n} className="embed-source"><b>{s.n}</b>{s.title}</span>)}
        </p>
      )}
    </div>
  );
}
