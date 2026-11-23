"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { api, renewedClerkSession } from "@/lib/api";
import type { LibraryDoc } from "./params";

// Upload (UI Phase 4), after the old Atlas's upload zone: drop or pick several files, choose who
// may read them, then each file uploads on its own (3 at a time) with its own progress bar and
// status: Uploading → Processing (Atlas is reading it) → Ready, or why it failed.

const ACCEPT = ".pdf,.docx,.md,.txt";
const MAX_MB = 10; // the API's max_upload_mb; the API checks again
const CONCURRENCY = 3;
const POLL_MS = 3000;

type State = "waiting" | "uploading" | "processing" | "ready" | "failed" | "error";
type Item = { key: number; file: File; state: State; progress: number; message?: string; docId?: number };

let nextKey = 0;
const mb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Problems we can see before uploading; the API checks the same things again. */
function precheck(file: File): string | undefined {
  const ext = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  if (!ACCEPT.split(",").includes(ext)) return "Atlas reads PDF, Word (.docx), Markdown or text files.";
  if (file.size > MAX_MB * 1024 * 1024) return `Over ${MAX_MB} MB. Pick a smaller file.`;
  if (file.size === 0) return "This file is empty.";
}

function message(status: number, body: string): string {
  try {
    const detail = JSON.parse(body)?.detail;
    if (typeof detail === "string") return detail;
  } catch {}
  if (status === 413) return `Over ${MAX_MB} MB. Pick a smaller file.`;
  return status >= 500 ? "The Atlas server isn't answering right now." : `The server answered ${status}.`;
}

/** POST /documents with upload progress (fetch can't report it). Renews a stale Clerk session once on 401. */
function send(form: FormData, onProgress: (pct: number) => void, retried = false): Promise<LibraryDoc> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = async () => {
      if (xhr.status === 401 && !retried && (await renewedClerkSession())) {
        send(form, onProgress, true).then(resolve, reject);
      } else if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(message(xhr.status, xhr.responseText)));
      }
    };
    xhr.onerror = () => reject(new Error("The upload didn't reach the server. Check your connection and try again."));
    xhr.send(form);
  });
}

/** Drag-and-drop area with a real "Choose files" button (keyboard and screen readers use that). */
export function DropZone({ onFiles, big = false, title, body }: { onFiles: (files: File[]) => void; big?: boolean; title?: string; body?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div className={`drop ${big ? "drop-big" : ""}`} data-over={over || undefined}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(Array.from(e.dataTransfer.files)); }}>
      <span className="drop-icon" aria-hidden="true"><Icon name="upload" className={big ? "size-7" : "size-5"} /></span>
      {title && <h2 className="font-body text-lg font-semibold">{title}</h2>}
      <p className="text-sm text-muted">{body ?? "Drag files here, or choose them."}</p>
      <button type="button" className={`btn ${big ? "btn-primary" : ""}`} onClick={() => input.current?.click()}>
        <Icon name="upload" className="size-4" />Choose files
      </button>
      <p className="text-xs text-muted">PDF, Word, Markdown or text · up to {MAX_MB} MB each · several at once</p>
      <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Files dropped on the page's empty-state zone before the dialog opened. */
  files: File[];
  isAdmin: boolean;
  uploadTo: string[];
  /** The department filter in use, when this person may upload there. */
  preferred: string;
};

export function UploadDialog({ open, onClose, files, isAdmin, uploadTo, preferred }: Props) {
  const client = useQueryClient();
  const ref = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dept, setDept] = useState("");
  const [isPublic, setPublic] = useState(false);
  const access = uploadTo.includes(dept) ? dept : preferred || uploadTo[0] || "";

  const add = (list: File[]) => {
    if (!list.length) return;
    setItems((xs) => [...xs, ...list.map((file): Item => {
      const problem = precheck(file);
      return { key: ++nextKey, file, state: problem ? "error" : "waiting", progress: 0, message: problem };
    })]);
  };
  const patch = (key: number, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  // Open/close the native modal; keep the files dropped on the page.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      add(files);
    } else if (!open && d.open) d.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- files only matter at the moment it opens
  }, [open]);

  // Processing → Ready / Failed: ask for each file's status until Atlas has read it.
  const reading = items.filter((x) => x.state === "processing" && x.docId).map((x) => x.docId as number);
  const readingKey = reading.join(",");
  useEffect(() => {
    if (!readingKey) return;
    const t = setInterval(async () => {
      for (const id of readingKey.split(",").map(Number)) {
        const d = await api<LibraryDoc>(`/documents/${id}`).catch(() => null);
        if (!d || d.status === "queued" || d.status === "processing") continue;
        setItems((xs) => xs.map((x) => (x.docId === id
          ? { ...x, state: d.status === "ready" ? "ready" : "failed", message: d.status === "failed" ? d.error ?? "Atlas couldn't read this file." : undefined }
          : x)));
        client.invalidateQueries({ queryKey: ["library"] });
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [readingKey, client]);

  async function upload() {
    const queue = items.filter((x) => x.state === "waiting");
    if (!queue.length || !access) return;
    const pub = isAdmin && isPublic && access === "Everyone";
    const worker = async () => {
      for (let it = queue.shift(); it; it = queue.shift()) {
        const form = new FormData();
        form.set("file", it.file);
        form.set("access", access);
        if (pub) form.set("is_public", "true");
        const key = it.key;
        patch(key, { state: "uploading", progress: 0, message: undefined });
        try {
          const doc = await send(form, (progress) => patch(key, { progress }));
          patch(key, { state: doc.status === "ready" ? "ready" : doc.status === "failed" ? "failed" : "processing", docId: doc.id, progress: 100 });
        } catch (e) {
          patch(key, { state: "error", message: (e as Error).message });
        }
        // New rows show up in the list at once (as Processing).
        client.invalidateQueries({ queryKey: ["library"] });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  }

  function close() {
    // Files still uploading or being read stay in the list (they carry on in the background).
    setItems((xs) => xs.filter((x) => x.state === "uploading" || x.state === "processing"));
    onClose();
  }

  const waiting = items.filter((x) => x.state === "waiting").length;
  const sending = items.some((x) => x.state === "uploading");

  return (
    <dialog ref={ref} className="dialog up-dialog" aria-labelledby="up-title" aria-describedby="up-desc"
      onCancel={(e) => { e.preventDefault(); close(); }}>
      <div className="grid gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 id="up-title" className="text-xl font-semibold">Upload documents</h2>
            <p id="up-desc" className="text-sm text-muted">Atlas reads each file. Once it shows Ready, Atlas can answer from it.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={close}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="up-access">
          <label className="grid gap-1 text-sm font-medium" htmlFor="up-dept">
            Who can read them
            <select id="up-dept" className="field" value={access} onChange={(e) => setDept(e.target.value)}>
              {uploadTo.map((d) => <option key={d} value={d}>{d === "Everyone" ? "Everyone in the company" : d}</option>)}
            </select>
          </label>
          <p className="text-xs text-muted">
            {access === "Everyone" ? "Everyone in the company can read them and get answers from them." : `Only ${access} and admins can read them.`}
            {!isAdmin && " You can add documents to your own departments."}
          </p>
          {isAdmin && access === "Everyone" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-accent" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} />
              Also show on the website (visitors can get answers from them)
            </label>
          )}
        </div>

        <DropZone onFiles={add} />

        {items.length > 0 && (
          <ul className="up-list" aria-label="Files" aria-live="polite">
            {items.map((it) => <FileRow key={it.key} it={it} onRemove={() => setItems((xs) => xs.filter((x) => x.key !== it.key))} />)}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className="btn" onClick={close}>{items.some((x) => x.state !== "waiting") ? "Done" : "Cancel"}</button>
          <button type="button" className="btn btn-primary" disabled={!waiting || !access} aria-disabled={sending || undefined} onClick={upload}>
            <Icon name="upload" className="size-4" />{waiting > 1 ? `Upload ${waiting} files` : "Upload"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

const LABEL: Record<State, string> = {
  waiting: "Ready to upload", uploading: "Uploading", processing: "Processing: Atlas is reading it",
  ready: "Ready", failed: "Failed", error: "Not uploaded",
};
const TONE: Partial<Record<State, string>> = { processing: "info", ready: "success", failed: "error", error: "error" };

function FileRow({ it, onRemove }: { it: Item; onRemove: () => void }) {
  return (
    <li className="up-item" data-state={it.state}>
      <div className="up-line">
        <span className="up-name" title={it.file.name}>{it.file.name}</span>
        <span className="text-xs text-muted">{mb(it.file.size)}</span>
        <span className="badge" data-tone={TONE[it.state]}>
          {it.state === "processing" && <span className="dot lib-pulse" aria-hidden="true" />}
          {it.state === "ready" && <Icon name="check" />}
          {(it.state === "failed" || it.state === "error") && <Icon name="alert" />}
          {it.state === "uploading" ? `Uploading ${it.progress}%` : LABEL[it.state]}
        </span>
        {(it.state === "waiting" || it.state === "error") && (
          <button type="button" className="icon-btn up-remove" aria-label={`Remove ${it.file.name}`} onClick={onRemove}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>
      {it.state === "uploading" && <progress className="up-bar" max={100} value={it.progress} aria-label={`Uploading ${it.file.name}`} />}
      {it.message && <p className="up-msg">{it.message}</p>}
    </li>
  );
}
