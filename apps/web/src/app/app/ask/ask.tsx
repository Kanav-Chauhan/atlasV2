"use client";

import { useChat } from "@ai-sdk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, generateId, type UIMessage } from "ai";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Reader, type Size } from "./reader";

// Stream parts from /api/chat (docs/API.md, Phase 5).
export type Source = {
  n: number; chunk_id: string; document_id: string; title: string; doc_no: string | null;
  page: number | null; section: string | null; text: string; superseded: boolean;
};
type Meta = {
  route: "smalltalk" | "offtopic" | "blocked" | "rag"; abstained: boolean; cached: boolean;
  rewritten_query?: string; language: "en" | "hi"; message_id: string; trace_id?: string;
};
type Stage = "guard" | "cache" | "route" | "rewrite" | "retrieve" | "rerank" | "grade" | "retry" | "answer";
type AtlasMessage = UIMessage<unknown, { sources: { sources: Source[] }; meta: Meta; status: { stage: Stage } }>;
type ChatSummary = { id: string; title: string; updated_at: string };

const STAGE_TEXT: Record<Stage, string> = {
  guard: "Reading your question…", cache: "Reading your question…", route: "Reading your question…",
  rewrite: "Searching your documents…", retrieve: "Searching your documents…", retry: "Searching a little wider…",
  rerank: "Checking sources…", grade: "Checking sources…", answer: "Writing the answer…",
};

const transport = new DefaultChatTransport<AtlasMessage>({ api: "/api/chat" });
// Thread ids made in this tab: nothing to load from the server for them.
const fresh = new Set<string>();
const newChatUrl = (q?: string | null) => {
  const id = generateId();
  fresh.add(id);
  return `/app/ask?c=${id}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
};

const textOf = (m: AtlasMessage) => m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
const sourcesOf = (m: AtlasMessage) => m.parts.find((p) => p.type === "data-sources")?.data.sources ?? [];
const metaOf = (m: AtlasMessage) => m.parts.find((p) => p.type === "data-meta")?.data;

/** The API's {"detail"} if the error body carries one, otherwise a plain sentence. */
function errorText(e: Error) {
  try { const d = JSON.parse(e.message).detail; if (typeof d === "string") return d; } catch {}
  return "Atlas couldn't finish this answer. Check your connection and try again.";
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={d} /></svg>
);

export function Ask({ company }: { company: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const c = params.get("c");
  const q = params.get("q");
  useEffect(() => { if (!c) router.replace(newChatUrl(q)); }, [c, q, router]);
  return c ? <Thread key={c} id={c} q={q} company={company} /> : null;
}

function Thread({ id, q, company }: { id: string; q: string | null; company: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage | null>(null);
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [open, setOpen] = useState<{ msg: string; n: number } | null>(null);
  const [size, setSize] = useState<Size>("half");
  const opener = useRef<HTMLElement | null>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, setMessages, status, stop, error, regenerate } = useChat<AtlasMessage>({
    id, transport,
    onData: (p) => { if (p.type === "data-status") setStage(p.data.stage); },
    onFinish: () => { setStage(null); fresh.delete(id); qc.invalidateQueries({ queryKey: ["chats"] }); },
    onError: () => setStage(null),
  });
  const busy = status === "submitted" || status === "streaming";

  const [load] = useState(() => !fresh.has(id));
  const saved = useQuery({
    queryKey: ["chat", id], enabled: load, retry: false,
    queryFn: () => api<{ id: string; title: string; messages: AtlasMessage[] }>(`/chats/${id}`),
  });
  useEffect(() => { if (saved.data) setMessages(saved.data.messages); }, [saved.data, setMessages]);
  const loadFailed = saved.error && (saved.error as Error & { status?: number }).status !== 404;

  const suggested = useQuery({ queryKey: ["suggested"], staleTime: Infinity, queryFn: () => api<{ questions: string[] }>("/me/suggested") });
  const questions = suggested.data?.questions ?? [];

  const ask = (text: string) => {
    if (!text.trim() || busy) return;
    setStage(null);
    sendMessage({ text: text.trim() });
    setInput("");
  };

  // ?q= from Home's ask box: send it once, then drop it from the URL.
  const sentQ = useRef(false);
  useEffect(() => {
    if (!q || sentQ.current) return;
    sentQ.current = true;
    sendMessage({ text: q });
    router.replace(`/app/ask?c=${id}`);
  }, [q, id, router, sendMessage]);

  // Follow the answer while it streams, unless the reader scrolled up.
  useEffect(() => {
    const el = scroller.current;
    if (el && (status === "submitted" || el.scrollHeight - el.scrollTop - el.clientHeight < 160)) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const close = () => { setOpen(null); opener.current?.focus(); };
  const cite = (msg: string, n: number) => { opener.current = document.activeElement as HTMLElement; setOpen({ msg, n }); };
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (historyOpen) setHistoryOpen(false);
      else if (open) { setOpen(null); opener.current?.focus(); }
    };
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [historyOpen, open]);

  const openMsg = open && messages.find((m) => m.id === open.msg);
  const title = saved.data?.title || (messages[0] ? textOf(messages[0]) : "New chat");
  const last = messages.at(-1);

  return (
    <div className="ask" ref={workspace} data-reader={openMsg ? size : "closed"}>
      <section className="chat" aria-labelledby="chat-title">
        <header className="pane-head">
          <button type="button" className="btn" aria-expanded={historyOpen} aria-controls="history" onClick={() => setHistoryOpen(!historyOpen)}>
            <Icon d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 8v4.5l3 2" />History
          </button>
          <div className="chat-title">
            <h1 id="chat-title">{title}</h1>
            <p>{company}</p>
          </div>
          <button type="button" className="btn" onClick={() => router.push(newChatUrl())}>
            <Icon d="M12 5v14M5 12h14" />New chat
          </button>
        </header>
        {historyOpen && <History current={id} />}

        <div className="thread" ref={scroller}>
          <div className="thread-inner">
            {loadFailed ? (
              <section className="state" role="alert">
                <h2 className="font-body text-md font-semibold">This chat didn&apos;t load</h2>
                <p className="text-sm text-muted">{saved.error.message}</p>
                <button type="button" className="btn" onClick={() => saved.refetch()}>Retry</button>
              </section>
            ) : messages.length === 0 && saved.isFetching ? (
              <div className="grid gap-3" aria-busy="true" aria-label="Loading chat">
                <div className="skeleton" /><div className="skeleton" />
              </div>
            ) : messages.length === 0 ? (
              <section className="empty-chat">
                <h2>Ask a question</h2>
                <p>Atlas answers from {company || "company"} documents you can open, and shows the passage it used.</p>
                <div className="starters">
                  {questions.map((s) => <button key={s} type="button" onClick={() => ask(s)}>{s}</button>)}
                </div>
              </section>
            ) : messages.map((m, i) => m.role === "user" ? (
              <p key={m.id} className="q">{textOf(m)}</p>
            ) : (
              <Answer key={m.id} m={m} question={i > 0 ? textOf(messages[i - 1]) : ""}
                live={busy && m === last} current={open?.msg === m.id ? open.n : null} onCite={(n) => cite(m.id, n)} />
            ))}
            {busy && (last?.role === "user" || !textOf(last!)) && (
              <p className="status" role="status"><span className="pulse" aria-hidden="true" />{STAGE_TEXT[stage ?? "guard"]}</p>
            )}
            {error && (
              <section className="state" role="alert">
                <h2 className="font-body text-md font-semibold">The answer didn&apos;t finish</h2>
                <p className="text-sm text-muted">{errorText(error)}</p>
                <button type="button" className="btn" onClick={() => regenerate()}>Retry</button>
              </section>
            )}
          </div>
        </div>

        <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          <div className="composer-inner">
            {messages.length > 0 && questions.length > 0 && (
              <div className="chips" aria-label="Suggested questions">
                {questions.slice(0, 3).map((s) => <button key={s} type="button" className="chip" onClick={() => ask(s)} disabled={busy}>{s}</button>)}
              </div>
            )}
            <label className="sr-only" htmlFor="question">Your question</label>
            <div className="composer-row">
              <textarea id="question" rows={1} value={input} placeholder="Ask about any company document" autoComplete="off"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(input); }
                }} />
              {busy
                ? <button type="button" className="btn send" onClick={() => stop()}>Stop</button>
                : <button type="submit" className="btn btn-primary send" disabled={!input.trim()}>Ask</button>}
            </div>
            <p className="hint">Answers come only from documents you can open. Hindi works too.</p>
          </div>
        </form>
      </section>

      {openMsg && (
        <Reader key={open.msg} sources={sourcesOf(openMsg)} n={open.n} onN={(n) => setOpen({ msg: open.msg, n })}
          size={size} onSize={setSize} onClose={close} company={company} workspace={workspace} />
      )}
    </div>
  );
}

type AnswerProps = { m: AtlasMessage; question: string; live: boolean; current: number | null; onCite: (n: number) => void };

function Answer({ m, question, live, current, onCite }: AnswerProps) {
  const text = textOf(m);
  const sources = sourcesOf(m);
  const meta = metaOf(m);
  const request = useMutation({ mutationFn: () => api("/documents/request", { question }) });

  if (meta?.abstained) return (
    <div className="notfound" role="status">
      <strong>Not found in your documents</strong>
      <p>{text.replace(/^\s*Not found in your documents\.?\s*/i, "") || "No document you can open answers this, so Atlas did not guess. If a document exists, someone who manages it can share it with you."}</p>
      <button type="button" className="btn" disabled={request.isPending || request.isSuccess} onClick={() => request.mutate()}>
        {request.isSuccess ? "Request sent" : request.isPending ? "Sending…" : "Request a document"}
      </button>
      {request.error && <p role="alert">{request.error.message}</p>}
    </div>
  );

  if (!text && live) return null;
  return (
    <div className="a">
      <Markdown text={text} sources={sources} live={live} current={current} onCite={onCite} />
      {sources.length > 0 && (
        <div className="sources" aria-label="Sources">
          {sources.map((s) => (
            <button key={s.n} type="button" onClick={() => onCite(s.n)} aria-current={current === s.n || undefined}>
              <b>{s.n}</b>{s.title}{s.page != null && `, page ${s.page}`}
            </button>
          ))}
        </div>
      )}
      {(meta?.rewritten_query || meta?.cached) && (
        <p className="answer-meta">
          {meta.rewritten_query && <span>Searched for: {meta.rewritten_query}</span>}
          {meta.cached && <span>From cache</span>}
        </p>
      )}
      {!live && text && <Actions id={meta?.message_id ?? m.id} text={text} />}
    </div>
  );
}

function Actions({ id, text }: { id: string; text: string }) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);
  const send = (value: "up" | "down") => {
    setVote(value);
    api("/feedback", { message_id: id, value }).catch(() => setVote(null));
  };
  const copy = () => navigator.clipboard.writeText(text.replace(/\s?\[\d+\]/g, "")).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });
  return (
    <div className="actions">
      <button type="button" className="icon-btn" aria-label="Helpful" aria-pressed={vote === "up"} onClick={() => send("up")}>
        <Icon d="M7 10v10H4V10zM7 10l4-7c1.5 0 2.5 1 2.2 2.6L12.6 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7" />
      </button>
      <button type="button" className="icon-btn" aria-label="Not helpful" aria-pressed={vote === "down"} onClick={() => send("down")}>
        <Icon d="M17 14V4h3v10zM17 14l-4 7c-1.5 0-2.5-1-2.2-2.6l.6-3.4H5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.2 4H17" />
      </button>
      <button type="button" className="icon-btn" aria-label={copied ? "Copied" : "Copy answer"} onClick={copy}>
        <Icon d={copied ? "M5 12l5 5L20 7" : "M8 8h12v12H8zM16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"} />
      </button>
      <span className="sr-only" role="status">{copied ? "Copied" : ""}</span>
    </div>
  );
}

/** Just enough markdown for answers: paragraphs, - / 1. lists, **bold**, and [n] citation chips. */
function Markdown({ text, sources, live, current, onCite }: { text: string; sources: Source[]; live: boolean; current: number | null; onCite: (n: number) => void }) {
  const blocks: { kind: "p" | "ul" | "ol"; items: string[] }[] = [];
  let gap = true;
  for (const line of text.split("\n")) {
    if (!line.trim()) { gap = true; continue; }
    const li = line.match(/^\s*([-*•]|\d+[.)])\s+(.*)/);
    const kind = li ? (/\d/.test(li[1]) ? "ol" : "ul") : "p";
    if (gap || blocks.at(-1)!.kind !== kind) blocks.push({ kind, items: [] });
    blocks.at(-1)!.items.push(li ? li[2] : line.replace(/^#+\s*/, ""));
    gap = false;
  }
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*|\[\d+\])/).map((t, i) => {
    const n = t.match(/^\[(\d+)\]$/)?.[1];
    if (n) {
      const src = sources.find((x) => x.n === +n);
      if (!src && !live) return null; // a marker with no cited passage behind it
      return (
        <button key={i} type="button" className="cite" disabled={!src} onClick={() => onCite(+n)}
          aria-current={current === +n || undefined} aria-label={src ? `Source ${n}: ${src.title}` : `Source ${n}`}>{n}</button>
      );
    }
    return t.startsWith("**") && t.endsWith("**") && t.length > 4 ? <strong key={i}>{t.slice(2, -2)}</strong> : <Fragment key={i}>{t}</Fragment>;
  });
  return blocks.map((b, i) => b.kind === "p"
    ? <p key={i}>{inline(b.items.join(" "))}</p>
    : <b.kind key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</b.kind>);
}

function History({ current }: { current: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, error, isPending, refetch } = useQuery({ queryKey: ["chats"], queryFn: () => api<ChatSummary[]>("/chats") });
  const remove = useMutation({
    mutationFn: async (chatId: string) => {
      const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("That chat couldn't be deleted. Try again.");
    },
    onSuccess: (_, chatId) => {
      qc.invalidateQueries({ queryKey: ["chats"] });
      if (chatId === current) router.push(newChatUrl());
    },
  });

  const today = new Date().toDateString();
  const time = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" });
  const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
  const groups = [
    { name: "Today", items: data?.filter((t) => new Date(t.updated_at).toDateString() === today) ?? [] },
    { name: "Earlier", items: data?.filter((t) => new Date(t.updated_at).toDateString() !== today) ?? [] },
  ];

  return (
    <nav id="history" className="history-panel" aria-label="Past chats">
      {error ? (
        <section className="grid justify-items-start gap-2 p-2" role="alert">
          <p className="text-sm text-muted">{error.message}</p>
          <button type="button" className="btn" onClick={() => refetch()}>Retry</button>
        </section>
      ) : isPending ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading past chats"><div className="skeleton" /><div className="skeleton" /></div>
      ) : data.length === 0 ? (
        <p className="p-2 text-sm text-muted">Your past chats appear here.</p>
      ) : groups.map((g) => g.items.length > 0 && (
        <Fragment key={g.name}>
          <h2>{g.name}</h2>
          <ul>
            {g.items.map((t) => (
              <li key={t.id}>
                <Link href={`/app/ask?c=${t.id}`} aria-current={t.id === current || undefined}>
                  {t.title}
                  <small>{(g.name === "Today" ? time : day).format(new Date(t.updated_at))}</small>
                </Link>
                <button type="button" className="icon-btn" aria-label={`Delete chat: ${t.title}`}
                  disabled={remove.isPending && remove.variables === t.id} onClick={() => remove.mutate(t.id)}>
                  <Icon d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
                </button>
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
      {remove.error && <p className="p-2 text-sm text-error" role="alert">{remove.error.message}</p>}
    </nav>
  );
}
