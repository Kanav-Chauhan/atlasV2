"use client";

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { detail } from "@/lib/api";
import type { Review } from "@/lib/types";
import { ChunkPanel } from "./chunks";

export type Doc = {
  id: string;
  title: string;
  doc_no: string | null;
  access: string;
  is_public: boolean;
  format: string;
  status: "queued" | "processing" | "ready" | "failed";
  error: string | null;
  pages: number | null;
  updated_at: string;
  superseded_by: string | null;
};

type Props = { initial: Doc[] | null; canUpload: boolean; isAdmin: boolean; uploadTo: string[]; review: Review[] };

const STATUS = { ready: "Ready", processing: "Processing", queued: "Queued", failed: "Failed" } as const;
const MAX_BYTES = 10 * 1024 * 1024;
const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

async function fetchDocs(): Promise<Doc[]> {
  const res = await fetch("/api/documents", { cache: "no-store" });
  if (!res.ok) throw new Error(await detail(res));
  return res.json();
}

export function Library(props: Props) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <LibraryView {...props} />
    </QueryClientProvider>
  );
}

function LibraryView({ initial, canUpload, isAdmin, uploadTo, review }: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const q = params.get("q") ?? "";
  const dept = params.get("access") ?? "";
  const dialog = useRef<HTMLDialogElement>(null);
  const [chunksOf, setChunksOf] = useState<Doc | null>(null);

  const { data, error, isPending, refetch, isRefetching } = useQuery({
    queryKey: ["documents"],
    queryFn: fetchDocs,
    initialData: initial ?? undefined,
    retry: 1,
    // Poll every 5 s while anything is still being read.
    refetchInterval: (query) => (query.state.data?.some((d) => d.status === "queued" || d.status === "processing") ? 5000 : false),
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(next.size ? `${path}?${next}` : path, { scroll: false });
  };

  const depts = [...new Set((data ?? []).map((d) => d.access))].sort((a, b) => (a === "Everyone" ? -1 : b === "Everyone" ? 1 : a.localeCompare(b)));
  const shown = (data ?? []).filter((d) => (!dept || d.access === dept) && d.title.toLowerCase().includes(q.trim().toLowerCase()));
  const uploadBtn = canUpload && (
    <button type="button" className="btn btn-primary" onClick={() => dialog.current?.showModal()}>Upload</button>
  );

  return (
    <div className="lib mx-auto grid max-w-6xl gap-6 px-[var(--gutter)] py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold">Library</h1>
          <p className="text-muted">Documents you can open.</p>
        </div>
        {uploadBtn}
      </header>

      {error && !data ? (
        <section className="state" role="alert">
          <h2 className="font-body text-md font-semibold">The document list didn&apos;t load</h2>
          <p className="text-sm text-muted">{error.message}</p>
          <button type="button" className="btn" onClick={() => refetch()} disabled={isRefetching}>{isRefetching ? "Retrying" : "Retry"}</button>
        </section>
      ) : isPending ? (
        <Skeleton />
      ) : data.length === 0 ? (
        <section className="state">
          <h2 className="font-body text-md font-semibold">{canUpload ? "No documents yet" : "No documents in your departments yet"}</h2>
          <p className="text-sm text-muted">{canUpload ? "Upload a PDF, Word, Markdown or text file to start." : "When someone adds one, it shows up here."}</p>
          {uploadBtn}
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="lib-q">Search by title</label>
            <input id="lib-q" type="search" className="field w-full sm:w-72" placeholder="Search by title" defaultValue={q} onChange={(e) => setParam("q", e.target.value)} />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Department">
              {["", ...depts].map((d) => (
                <button key={d || "all"} type="button" className="chip" aria-pressed={dept === d} onClick={() => setParam("access", d)}>
                  {d || "All departments"}
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-muted">No documents match this search.</p>
          ) : (
            <DocTable docs={shown} onChunks={setChunksOf} review={new Map(review.map((r) => [String(r.id), r.reason]))} />
          )}
        </>
      )}

      {chunksOf && <ChunkPanel doc={chunksOf} onClose={() => setChunksOf(null)} />}
      {canUpload && <UploadDialog ref={dialog} isAdmin={isAdmin} uploadTo={uploadTo} />}
    </div>
  );
}

function DocTable({ docs, onChunks, review }: { docs: Doc[]; onChunks: (d: Doc) => void; review: Map<string, string> }) {
  return (
    <table className="docs">
      <thead>
        <tr><th scope="col">Title</th><th scope="col">Department</th><th scope="col">Format</th><th scope="col">Status</th><th scope="col">Pages</th><th scope="col">Updated</th></tr>
      </thead>
      <tbody>
        {docs.map((d) => (
          <tr key={d.id}>
            <td className="title-cell"><div>
              <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer">{d.title}</a>
              <span className="meta">
                {d.doc_no && <span className="text-muted">{d.doc_no}</span>}
                {d.is_public && <span className="tag">Public</span>}
                {d.superseded_by && <span className="tag tag-warn">Superseded</span>}
                {review.has(String(d.id)) && <span className="tag tag-warn" title={review.get(String(d.id))}>Needs review<span className="sr-only">: {review.get(String(d.id))}</span></span>}
                {d.status === "ready" && (
                  <button type="button" className="chunks-btn" onClick={() => onChunks(d)}>Chunks<span className="sr-only">: {d.title}</span></button>
                )}
              </span>
            </div></td>
            <td data-label="Department">{d.access}</td>
            <td data-label="Format">{d.format.toUpperCase()}</td>
            <td data-label="Status" className="status-cell">
              <span className={`status status-${d.status}`} title={d.status === "failed" ? d.error ?? "Reading this file failed." : undefined}>
                {STATUS[d.status]}
              </span>
              {d.status === "failed" && d.error && <span className="sr-only">: {d.error}</span>}
            </td>
            <td data-label="Pages">{d.pages ?? <span className="text-muted">Not yet</span>}</td>
            <td data-label="Updated">{date.format(new Date(d.updated_at))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading documents">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" />)}
    </div>
  );
}

function UploadDialog({ ref, isAdmin, uploadTo }: { ref: React.RefObject<HTMLDialogElement | null>; isAdmin: boolean; uploadTo: string[] }) {
  const client = useQueryClient();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = new FormData(form);
    const file = body.get("file");
    if (file instanceof File && file.size > MAX_BYTES) return setErr("That file is over 10 MB. Pick a smaller one.");
    if (!isAdmin) body.delete("is_public");
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/documents", { method: "POST", body });
      if (!res.ok) return setErr(await detail(res));
      const doc: Doc = await res.json();
      client.setQueryData<Doc[]>(["documents"], (old) => [doc, ...(old ?? [])]);
      form.reset();
      ref.current?.close();
    } catch {
      setErr("The upload didn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="up-title" onClose={() => setErr("")}>
      <form className="grid gap-4" onSubmit={submit}>
        <h2 id="up-title" className="text-xl font-semibold">Upload a document</h2>
        <label className="grid gap-1 text-sm font-medium">
          File
          <input name="file" type="file" required accept=".pdf,.docx,.md,.txt" className="field" />
          <span className="font-normal text-muted">PDF, Word, Markdown or text, up to 10 MB.</span>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Department
          <select name="access" required className="field">
            {uploadTo.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm">
            <input name="is_public" type="checkbox" value="true" className="size-4 accent-accent" />
            Show on website
          </label>
        )}
        {err && <p className="text-sm text-error" role="alert">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Uploading" : "Upload"}</button>
        </div>
      </form>
    </dialog>
  );
}
