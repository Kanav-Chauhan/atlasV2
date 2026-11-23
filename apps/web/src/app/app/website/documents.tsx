"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useRef, useState } from "react";
import { DocViewer } from "@/components/doc-viewer/doc-viewer";
import { type DocRef, useViewerSize } from "@/components/doc-viewer/use-doc-viewer";
import { Region } from "@/components/region";
import { Card } from "@/components/ui/page";
import { Icon } from "@/components/ui/icons";
import { api, detail } from "@/lib/api";
import type { Paged, WebsiteChat } from "@/lib/website";
import { dayOnly, openModal, Pager, SearchBox, Switch, useDebounced } from "./parts";

// "Website documents": the only documents the website bot reads. Two ways to add one:
// upload a new file (goes into the Library as an Everyone document, public at once), or pick
// existing Everyone documents from the Library. Department documents are listed with their
// department but can't be ticked: they must be opened to Everyone in the Library first.

export type WebDoc = {
  id: number; title: string; doc_no: string | null; access: string; is_public: boolean; format: string;
  status: "queued" | "processing" | "ready" | "failed"; updated_at: string;
};
type DocsPage = Paged<WebDoc> & { public_total: number };

const PER_PAGE = 20;
const FORMAT: Record<string, string> = { pdf: "PDF", docx: "Word", md: "Markdown", txt: "Text" };
const STATUS = { queued: "Queued", processing: "Reading", failed: "Failed" } as const;
const MAX_BYTES = 10 * 1024 * 1024;

const docsUrl = (pub: boolean, q: string, page: number) =>
  `/website-chat/documents?${new URLSearchParams({ public: String(pub), q, page: String(page), per_page: String(PER_PAGE) })}`;

export function WebsiteDocuments() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const term = useDebounced(q.trim());
  const docs = useQuery({
    queryKey: ["website-docs", true, term, page],
    queryFn: () => api<DocsPage>(docsUrl(true, term, page)),
    placeholderData: keepPreviousData,
  });
  // Rows switched off stay on screen (greyed) until the next load, so a mistake is one click to undo.
  const [off, setOff] = useState<Set<number>>(new Set());
  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) => api<WebDoc>(`/documents/${id}`, { is_public: on }, "PATCH"),
    onSuccess: (d) => {
      setOff((s) => { const n = new Set(s); if (d.is_public) n.delete(d.id); else n.add(d.id); return n; });
      qc.setQueryData<WebsiteChat>(["website-chat"], (c) => c && { ...c, public_documents: c.public_documents + (d.is_public ? 1 : -1) });
    },
  });
  const refresh = () => { setOff(new Set()); qc.invalidateQueries({ queryKey: ["website-docs"] }); qc.invalidateQueries({ queryKey: ["website-chat"] }); };
  const [viewer, setViewer] = useState<Required<DocRef> | null>(null);
  const [size, setSize] = useViewerSize();
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);

  const total = docs.data ? docs.data.public_total - off.size : null;
  return (
    <div className="grid gap-[var(--page-gap)]">
      <Card tone="info" className="site-scope">
        <div className="site-scope-row">
          <Icon name="book" className="size-6" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold">
              {total === null ? "The website bot answers only from these documents" : total === 1 ? "The website bot answers only from this 1 document" : `The website bot answers only from these ${total} documents`}
            </h2>
            <p className="text-sm text-muted">Visitors can read what&apos;s in them. Everything else in your Library stays private to your team.</p>
          </div>
          <div className="site-scope-actions">
            <button type="button" className="btn btn-primary" onClick={() => setUploading(true)}><Icon name="upload" />Upload a file</button>
            <button type="button" className="btn" onClick={() => setPicking(true)}><Icon name="library" />Pick from Library</button>
          </div>
        </div>
      </Card>

      <Card title="On the website" id="wd" className="site-docs-card" action={<SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} label="Search website documents" placeholder="Search by title" />}>
        <Region q={docs} what="website documents" isEmpty={(d) => d.items.length === 0}
          empty={term
            ? <><p className="text-sm font-semibold">No website document matches &ldquo;{term}&rdquo;</p><button type="button" className="btn" onClick={() => setQ("")}>Clear search</button></>
            : <><p className="text-sm font-semibold">No documents on the website yet</p><p className="text-sm text-muted">Upload a file or pick documents from your Library. Until then the bot can only say it doesn&apos;t know.</p></>}>
          {(d) => (
            <>
              <ul className="site-rows" aria-busy={docs.isPlaceholderData || undefined}>
                {d.items.map((doc) => {
                  const on = !off.has(doc.id);
                  return (
                    <li key={doc.id} data-off={!on || undefined}>
                      <button type="button" className="site-doc" onClick={() => setViewer({ doc: String(doc.id), page: null, chunk: null, tab: null })}>
                        <Icon name="file" className="size-5 text-muted" />
                        <span className="min-w-0">
                          <span className="site-title">{doc.title}</span>
                          <small>
                            {FORMAT[doc.format] ?? doc.format}{doc.doc_no ? ` · ${doc.doc_no}` : ""} · updated {dayOnly.format(new Date(doc.updated_at))}
                            {doc.status !== "ready" && <span className="badge ml-2" data-tone={doc.status === "failed" ? "error" : "info"}>{STATUS[doc.status]}</span>}
                          </small>
                        </span>
                      </button>
                      <span className="site-toggle">
                        <span className="text-xs text-muted" aria-hidden="true">{on ? "On website" : "Removed"}</span>
                        <Switch on={on} label={`${doc.title}: on the website`} disabled={toggle.isPending && toggle.variables?.id === doc.id}
                          onChange={(v) => toggle.mutate({ id: doc.id, on: v })} />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Pager page={page} perPage={PER_PAGE} total={d.total} onPage={setPage} what="Website documents" />
            </>
          )}
        </Region>
        {toggle.error && <p className="text-sm text-error" role="alert">{toggle.error.message}</p>}
      </Card>

      {uploading && <UploadDialog onClose={() => setUploading(false)} onDone={refresh} />}
      {picking && <PickDialog onClose={() => setPicking(false)} onDone={refresh} />}
      {viewer && (
        <Suspense>
          <DocViewer mode="overlay" current={viewer} onUpdate={(p) => setViewer((v) => v && { ...v, ...p } as Required<DocRef>)}
            onClose={() => setViewer(null)} size={size} onSize={setSize} canSeeChunks />
        </Suspense>
      )}
    </div>
  );
}

function UploadDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = new FormData(e.currentTarget);
    const file = body.get("file");
    if (!(file instanceof File) || !file.name) return setErr("Choose a file first.");
    if (file.size > MAX_BYTES) return setErr("That file is over 10 MB. Pick a smaller one.");
    body.set("access", "Everyone");
    body.set("is_public", "true");
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/documents", { method: "POST", body });
      if (!res.ok) return setErr(await detail(res));
      onDone();
      dialog.current?.close();
    } catch {
      setErr("The upload didn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog ref={(d) => { dialog.current = d; openModal(d); }} className="dialog" aria-labelledby="up-title" onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <div>
          <h2 id="up-title" className="text-lg font-semibold">Upload a file for the website</h2>
          <p className="text-sm text-muted">It goes into your Library for Everyone, and the website bot can answer from it once it has been read (about a minute).</p>
        </div>
        <label className="grid gap-1 text-sm font-medium">
          File
          <input name="file" type="file" required accept=".pdf,.docx,.md,.txt" className="field py-1.5" />
          <span className="font-normal text-muted">PDF, Word, Markdown or text, up to 10 MB.</span>
        </label>
        <p className="site-note" data-tone="warn"><strong>Visitors will be able to read this.</strong> Don&apos;t upload anything private: prices for one customer, staff details, internal plans.</p>
        {err && <p className="text-sm text-error" role="alert">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Uploading" : "Upload and show on website"}</button>
        </div>
      </form>
    </dialog>
  );
}

function PickDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const term = useDebounced(q.trim());
  const [picked, setPicked] = useState<Map<number, string>>(new Map());
  const list = useQuery({
    queryKey: ["website-docs", false, term, page],
    queryFn: () => api<DocsPage>(docsUrl(false, term, page)),
    placeholderData: keepPreviousData,
  });
  const add = useMutation({
    mutationFn: async () => {
      for (const id of picked.keys()) await api(`/documents/${id}`, { is_public: true }, "PATCH");
    },
    onSuccess: () => { onDone(); ref.current?.close(); },
    onError: () => onDone(), // some may have gone through
  });
  const flip = (d: WebDoc) => setPicked((m) => { const n = new Map(m); if (n.has(d.id)) n.delete(d.id); else n.set(d.id, d.title); return n; });

  return (
    <dialog ref={(d) => { ref.current = d; openModal(d); }} className="dialog site-pick" aria-labelledby="pk-title" onClose={onClose}>
      <div className="grid gap-4">
        <div>
          <h2 id="pk-title" className="text-lg font-semibold">Pick documents from your Library</h2>
          <p className="text-sm text-muted">Only documents your whole company can see (Everyone) can go on the website. Department documents show their department and can&apos;t be picked here.</p>
        </div>
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} label="Search the Library" placeholder="Search by title" />
        <div className="site-pick-list">
          <Region q={list} what="Library documents" isEmpty={(d) => d.items.length === 0}
            empty={<p className="text-sm text-muted">{term ? `Nothing in the Library matches “${term}”.` : "Every document is already on the website."}</p>}>
            {(d) => (
              <>
                <ul className="site-rows" aria-busy={list.isPlaceholderData || undefined}>
                  {d.items.map((doc) => {
                    const everyone = doc.access === "Everyone";
                    return (
                      <li key={doc.id}>
                        <label className="site-pick-row" data-locked={!everyone || undefined}>
                          <input type="checkbox" className="size-4 accent-accent" disabled={!everyone} checked={picked.has(doc.id)} onChange={() => flip(doc)} />
                          <span className="min-w-0">
                            <span className="site-title">{doc.title}</span>
                            <small>
                              {everyone ? "Everyone in the company" : `Only ${doc.access}: open it to Everyone in the Library first`}
                            </small>
                          </span>
                          {!everyone && <span className="badge" data-tone="warn">{doc.access}</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <Pager page={page} perPage={PER_PAGE} total={d.total} onPage={setPage} what="Library documents" />
              </>
            )}
          </Region>
        </div>
        {picked.size > 0 && (
          <p className="site-note" data-tone="warn" role="status">
            <strong>Visitors will be able to read {picked.size === 1 ? "this document" : `these ${picked.size} documents`}:</strong> {[...picked.values()].join(", ")}.
          </p>
        )}
        {add.error && <p className="text-sm text-error" role="alert">{add.error.message}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={picked.size === 0 || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? "Adding" : picked.size ? `Put ${picked.size} on the website` : "Put on the website"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
