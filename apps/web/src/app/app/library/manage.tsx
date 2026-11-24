"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import type { LibraryDoc } from "./params";
import { ACCEPT, precheck, send } from "./upload";

// Replace and Delete for one document, only where the API says `can_manage` (it checks again).

export type ManageTarget = { doc: LibraryDoc; action: "replace" | "delete" };

export function RowActions({ d, onManage }: { d: LibraryDoc; onManage: (t: ManageTarget) => void }) {
  if (!d.can_manage) return null;
  return (
    <span className="lib-actions">
      <button type="button" className="icon-btn" title="Replace with a new file" aria-label={`Replace ${d.title}`} aria-haspopup="dialog"
        onClick={() => onManage({ doc: d, action: "replace" })}><Icon name="upload" className="size-4" /></button>
      <button type="button" className="icon-btn lib-delete" title="Delete" aria-label={`Delete ${d.title}`} aria-haspopup="dialog"
        onClick={() => onManage({ doc: d, action: "delete" })}><Icon name="trash" className="size-4" /></button>
    </span>
  );
}

const openModal = (d: HTMLDialogElement | null) => { if (d && !d.open) d.showModal(); };

export function ManageDialog({ target, onClose, onDeleted }: { target: ManageTarget; onClose: () => void; onDeleted: (id: number) => void }) {
  const { doc, action } = target;
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState("");
  const replacing = action === "replace";

  const pick = (f: File | undefined) => {
    if (!f) return;
    const problem = precheck(f);
    setErr(problem ?? "");
    setFile(problem ? null : f);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || (replacing && !file)) return;
    setBusy(true);
    setErr("");
    try {
      if (replacing) {
        const form = new FormData();
        form.set("file", file!);
        await send(form, setPct, `/api/documents/${doc.id}/file`, "PUT");
        client.removeQueries({ predicate: (q) => q.queryKey.includes(String(doc.id)) || q.queryKey.includes(doc.id) });
      } else {
        await api(`/documents/${doc.id}`, undefined, "DELETE");
        onDeleted(doc.id);
      }
      await client.invalidateQueries({ queryKey: ["library"] });
      onClose();
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <dialog ref={openModal} className="dialog" aria-labelledby="mg-title" aria-describedby="mg-desc" onClose={onClose}
      onCancel={(e) => { if (busy) e.preventDefault(); }}>
      <form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-1">
          <h2 id="mg-title" className="text-xl font-semibold">{replacing ? "Replace this document" : "Delete this document?"}</h2>
          <p className="font-semibold" style={{ overflowWrap: "anywhere" }}>{doc.title}</p>
          <p id="mg-desc" className="text-sm text-muted">
            {replacing
              ? `The title, department (${doc.access}) and links stay the same. Atlas keeps answering from the old file until it has read the new one.`
              : "Atlas stops answering from it straight away, for everyone. Past answers that quoted it stay in people's chats. This can't be undone."}
          </p>
        </div>
        {replacing && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}><Icon name="file" className="size-4" />{file ? "Choose another" : "Choose the new file"}</button>
            <span className="text-sm text-muted" style={{ overflowWrap: "anywhere" }}>{file ? file.name : "PDF, Word, Markdown or text · up to 10 MB"}</span>
            <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true"
              onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        )}
        {busy && replacing && <progress className="up-bar" max={100} value={pct} aria-label="Uploading" />}
        {err && <p className="text-sm text-error" role="alert">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" className={`btn ${replacing ? "btn-primary" : "lib-delete-btn"}`} disabled={busy || (replacing && !file)}>
            {replacing ? (busy ? "Uploading" : "Replace") : busy ? "Deleting" : "Delete"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
