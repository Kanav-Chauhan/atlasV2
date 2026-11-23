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
// No new answer text for this long (from the question or the last token) = give up, abort the fetch, offer Retry.
const NO_ANSWER_MS = 60_000;
const NO_ANSWER = "No answer came. Try again.";
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function EmbedChat({ siteKey, config, preview }: { siteKey: string; config: PublicConfig; preview: boolean }) {
  const [id] = useState(() => threadId(siteKey));
  const [transport] = useState(() => new DefaultChatTransport<AtlasMessage>({ api: `/api/public/${siteKey}/chat` }));
  const [stage, setStage] = useState<Stage | null>(null);
  const [input, setInput] = useState("");
  // The answer never came: 60 s without new text, or the stream closed without its finish part.
  const [failed, setFailed] = useState(false);
  const timedOut = useRef(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const shownQ = useRef<string | null>(null);
  const framed = useSyncExternalStore(() => () => {}, () => !preview && window.parent !== window, () => false);

  const { messages, sendMessage, status, stop, error, regenerate } = useChat<AtlasMessage>({
    id, transport,
    onData: (p) => { if (p.type === "data-status") setStage(p.data.stage); },
    onFinish: ({ message, isAbort, isError, finishReason }) => {
      setStage(null);
      // A cut connection ends the stream without a finish part and the SDK reports no error:
      // without this the visitor saw their question and then nothing at all.
      if (timedOut.current || (!isAbort && !isError && (!finishReason || (message.role === "assistant" && !textOf(message) && !metaOf(message)?.abstained)))) setFailed(true);
      timedOut.current = false;
    },
    onError: () => setStage(null),
  });
  const busy = status === "submitted" || status === "streaming";
  const last = messages.at(-1);
  const body = () => ({ body: { website: honeypot.current?.value ?? "" } });

  const ask = () => {
    // Read the box itself: text typed before the page finished loading never reached `input`.
    const text = (box.current?.value ?? input).trim();
    if (!text || busy) return;
    setStage(null);
    setFailed(false);
    sendMessage({ text }, body());
    setInput("");
  };
  const retry = () => {
    if (busy) return;
    setStage(null);
    setFailed(false);
    regenerate(body()); // resends the same question (drops a half answer first)
  };

  // Watchdog: restarts on every new piece of answer text; stop() aborts the hung fetch.
  const answered = last?.role === "assistant" ? textOf(last).length : 0;
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => { timedOut.current = true; stop(); }, NO_ANSWER_MS);
    return () => clearTimeout(t);
  }, [busy, answered, stop]);

  // A new question scrolls to the top of the thread once (like ChatGPT); the answer grows below it
  // and the thread never auto-scrolls after that, so the visitor's own scrolling is left alone.
  const lastQ = messages.findLast((m) => m.role === "user")?.id ?? null;
  useEffect(() => {
    const el = scroller.current;
    if (!el || !lastQ || lastQ === shownQ.current) return;
    shownQ.current = lastQ;
    const q = el.querySelector<HTMLElement>(".embed-last .q");
    if (q) el.scrollTo({ top: q.offsetTop - parseFloat(getComputedStyle(el).paddingTop), behavior: reducedMotion() ? "auto" : "smooth" });
  }, [lastQ]);

  useEffect(() => {
    if (!framed) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [framed]);

  const split = Math.max(0, messages.findLastIndex((m) => m.role === "user"));
  const item = (m: AtlasMessage, i: number) => m.role === "user" ? <p key={m.id} className="q">{textOf(m)}</p>
    : <Reply key={m.id} m={m} live={busy && i === messages.length - 1} company={config.company} />;

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

      <div className="embed-thread" ref={scroller}>
        <p className="embed-greet">{config.greeting || `Hi! Ask me anything about ${config.company}.`}</p>
        {messages.slice(0, split).map(item)}
        {split < messages.length && (
          // The latest question and its answer: at least one screen tall, so the question can sit at the top.
          <div className="embed-last">
            {messages.slice(split).map((m, i) => item(m, split + i))}
            <p className="status" role="status" aria-live="polite">
              {busy && (last?.role === "user" || !textOf(last!)) && (
                <><span className="pulse" aria-hidden="true" />{STAGE_TEXT[stage ?? "guard"].replace("your documents", "our documents")}</>
              )}
            </p>
            {!busy && (error || failed) && (
              <div className="notfound" role="alert">
                <p>{error && errorText(error) !== errorText(new Error()) ? errorText(error) : NO_ANSWER}</p>
                <button type="button" className="btn" onClick={retry}>Retry</button>
              </div>
            )}
          </div>
        )}
      </div>

      <form className="embed-composer" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        {/* Honeypot: people never see or fill it; bots that fill every field are turned away by the API. */}
        <div className="embed-hp" aria-hidden="true">
          <label>Website<input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <label className="sr-only" htmlFor="embed-q">Your question</label>
        <textarea ref={box} id="embed-q" rows={1} maxLength={500} value={input} placeholder="Type your question" autoComplete="off" autoFocus={!preview}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(); } }} />
        {busy
          ? <button type="button" className="btn" onClick={() => stop()}>Stop</button>
          : <button type="submit" className="btn embed-send" disabled={!input.trim()}>Send</button>}
      </form>
      {config.show_badge && (
        <a className="embed-badge" href="https://p1.kanav.space" target="_blank" rel="noopener">Powered by Atlas</a>
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
  if (!text) return null;
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
