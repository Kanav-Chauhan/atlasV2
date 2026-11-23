"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ApiRole, Department, Person } from "@/lib/types";
import { cap, ROLES, type ImportOut, type ImportRow } from "./types";

// Opens as a modal on mount; closing (Esc, Cancel) unmounts it.
const openModal = (d: HTMLDialogElement | null) => { if (d && !d.open) d.showModal(); };

function useSubmit() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { err, busy, run };
}

function GroupPicker({ names, chosen, role }: { names: string[]; chosen: string[]; role: ApiRole }) {
  if (role === "admin") return <p className="text-sm text-muted">Admins read every group&apos;s documents.</p>;
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-sm font-medium">Groups</legend>
      {names.length === 0 && <p className="text-sm text-muted">No groups yet.</p>}
      <div className="pick-groups">
        {names.map((d) => (
          <label key={d} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="groups" value={d} defaultChecked={chosen.includes(d)} className="size-4 accent-accent" />{d}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">Everyone documents are always included.</p>
    </fieldset>
  );
}

export function PersonDialog({ person, isAdmin, groupNames, onDone, onClose }: {
  person: Person; isAdmin: boolean; groupNames: string[]; onDone: () => void; onClose: () => void;
}) {
  const [role, setRole] = useState<ApiRole>(person.role);
  const { err, busy, run } = useSubmit();
  const roles: ApiRole[] = isAdmin ? ROLES : ["member", "guest"];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      title: String(f.get("title") ?? "").trim(),
      role,
      departments: role === "admin" ? person.departments : f.getAll("groups").map(String),
      guest_until: role === "guest" ? String(f.get("guest_until") || "") || null : null,
    };
    run(() => api(`/team/${person.id}`, body, "PATCH").then(onDone));
  }

  return (
    <dialog ref={openModal} className="dialog" aria-labelledby="pd-title" onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <div>
          <h2 id="pd-title" className="text-xl font-semibold">Edit {person.name}</h2>
          <p className="text-sm text-muted">{person.email}</p>
        </div>
        <label className="grid gap-1 text-sm font-medium">Job title<input name="title" className="field" defaultValue={person.title} autoComplete="off" /></label>
        <label className="grid gap-1 text-sm font-medium">
          Role
          <select className="field" value={role} onChange={(e) => setRole(e.target.value as ApiRole)}>
            {roles.map((r) => <option key={r} value={r}>{cap(r)}</option>)}
          </select>
        </label>
        <GroupPicker names={groupNames} chosen={person.departments} role={role} />
        {role === "guest" && (
          <label className="grid gap-1 text-sm font-medium">
            Access until
            <input name="guest_until" type="date" className="field" defaultValue={person.guest_until?.slice(0, 10)} />
          </label>
        )}
        {err && <p className="text-sm text-error" role="alert">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving" : "Save"}</button>
        </div>
      </form>
    </dialog>
  );
}

const INVITE_WORD: Record<string, string> = {
  sent: "Invitation emails sent: they sign up with that address and land in this company.",
  exists: "They already have an Atlas login, so they can sign in now.",
  failed: "Some invitation emails didn't go out. Ask those people to sign up with their address.",
};

function inviteNote(rows: ImportRow[]) {
  const kinds = new Set(rows.map((r) => r.invite).filter(Boolean) as string[]);
  if (kinds.has("failed")) return ` ${INVITE_WORD.failed}`;
  if (kinds.has("sent")) return ` ${INVITE_WORD.sent}`;
  if (kinds.has("exists")) return ` ${INVITE_WORD.exists}`;
  return "";
}

/** Invite one or many people by email, with their role and groups chosen now (POST /team/import rows). */
export function InviteDialog({ dept, isAdmin, groupNames, onDone, onClose }: {
  dept?: string; isAdmin: boolean; groupNames: string[]; onDone: (note: string) => void; onClose: () => void;
}) {
  const [role, setRole] = useState<ApiRole>("member");
  const [problems, setProblems] = useState<ImportRow[]>([]);
  const { err, busy, run } = useSubmit();
  const roles: ApiRole[] = isAdmin ? ROLES : ["member", "guest"];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const emails = String(f.get("emails") ?? "").split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    const groups = role === "admin" ? "" : f.getAll("groups").map(String).join(";");
    const name = emails.length === 1 ? String(f.get("name") ?? "").trim() : "";
    const title = String(f.get("title") ?? "").trim();
    run(async () => {
      const r = await api<ImportOut>("/team/import", { dry_run: false, rows: emails.map((email) => ({ email, name, title, role, groups })) });
      const bad = r.rows.filter((x) => x.error);
      if (!r.created) { setProblems(bad); return; }
      const added = r.rows.filter((x) => !x.error);
      onDone(`Invited ${r.created} ${r.created === 1 ? "person" : "people"}.${inviteNote(added)}${bad.length ? ` ${bad.length} not added: ${bad.map((x) => `${x.email} (${x.error})`).join(", ")}` : ""}`);
    });
  }

  return (
    <dialog ref={openModal} className="dialog" aria-labelledby="inv-title" onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <div>
          <h2 id="inv-title" className="text-xl font-semibold">Invite people</h2>
          <p className="text-sm text-muted">They get the role and groups you pick here. For a long list, use Import CSV.</p>
        </div>
        <label className="grid gap-1 text-sm font-medium">
          Email addresses
          <textarea name="emails" required rows={3} className="field" placeholder={"neha@company.com\nravi@company.com"} autoComplete="off" />
          <span className="text-xs font-normal text-muted">One per line, or separated by commas.</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">Name <span className="sr-only">(one person only)</span><input name="name" className="field" placeholder="One person only" autoComplete="off" /></label>
          <label className="grid gap-1 text-sm font-medium">Job title<input name="title" className="field" autoComplete="off" /></label>
        </div>
        <label className="grid gap-1 text-sm font-medium">
          Role
          <select className="field" value={role} onChange={(e) => setRole(e.target.value as ApiRole)}>
            {roles.map((r) => <option key={r} value={r}>{cap(r)}</option>)}
          </select>
        </label>
        <GroupPicker names={groupNames} chosen={dept ? [dept] : []} role={role} />
        {problems.length > 0 && (
          <ul className="text-sm text-error" role="alert">
            {problems.map((p) => <li key={p.line}>{p.email || "(blank)"}: {p.error}</li>)}
          </ul>
        )}
        {err && <p className="text-sm text-error" role="alert">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Inviting" : "Invite"}</button>
        </div>
      </form>
    </dialog>
  );
}

const TEMPLATE = "email,name,title,role,groups\nneha.gupta@company.com,Neha Gupta,HR Manager,member,HR\nravi.k@company.com,Ravi K,Engineer,member,Engineering;Product\n";

function downloadTemplate() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
  a.download = "atlas-people.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** CSV import: pick or paste → check (dry run, every row validated) → add the valid rows. */
export function ImportDialog({ isAdmin, groupNames, onDone, onClose }: {
  isAdmin: boolean; groupNames: string[]; onDone: (note: string) => void; onClose: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ImportOut | null>(null);
  const { err, busy, run } = useSubmit();

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(null);
    setCsv(await file.text());
  }

  const check = () => run(async () => setPreview(await api<ImportOut>("/team/import", { csv, dry_run: true })));
  const apply = () => run(async () => {
    const r = await api<ImportOut>("/team/import", { csv, dry_run: false });
    const added = r.rows.filter((x) => !x.error);
    onDone(`Imported ${r.created} ${r.created === 1 ? "person" : "people"}.${inviteNote(added)}${r.invalid ? ` ${r.invalid} rows skipped.` : ""}`);
  });

  return (
    <dialog ref={openModal} className="dialog dialog-wide" aria-labelledby="imp-title" onClose={onClose}>
      <div className="grid gap-4">
        <div>
          <h2 id="imp-title" className="text-xl font-semibold">Import people from a CSV file</h2>
          <p className="text-sm text-muted">
            Columns: <code>email,name,title,role,groups</code>. Only email is required; role defaults to member; separate groups with <code>;</code>.
            Up to 500 rows. {!isAdmin && "You can add members and guests to your own groups."}
          </p>
          <button type="button" className="link-btn" onClick={downloadTemplate}>Download a template</button>
        </div>
        <label className="grid gap-1 text-sm font-medium">
          CSV file
          <input type="file" accept=".csv,text/csv" className="field" onChange={pick} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Or paste it here
          <textarea rows={5} className="field font-mono text-xs" value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }}
            placeholder={TEMPLATE} spellCheck={false} />
        </label>
        {groupNames.length > 0 && <p className="text-xs text-muted">Groups you can use: {groupNames.join(", ")}.</p>}

        {preview && (
          <div className="grid gap-2" aria-live="polite">
            <p className="text-sm">
              <span className="badge" data-tone="success">{preview.valid} ready</span>{" "}
              {preview.invalid > 0 && <span className="badge" data-tone="error">{preview.invalid} with problems (will be skipped)</span>}
            </p>
            <div className="table-wrap import-preview">
              <table className="tbl">
                <thead><tr><th scope="col">Line</th><th scope="col">Email</th><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Groups</th><th scope="col">Check</th></tr></thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.line} data-bad={r.error ? "" : undefined}>
                      <td className="text-muted">{r.line}</td><td>{r.email || "(blank)"}</td><td>{r.name}</td><td>{r.role}</td>
                      <td>{r.groups.join(", ") || <span className="text-muted">Everyone only</span>}</td>
                      <td>{r.error ? <span className="text-error">{r.error}</span> : <span className="yes">OK</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {err && <p className="text-sm text-error" role="alert">{err}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          {!preview
            ? <button type="button" className="btn btn-primary" disabled={busy || !csv.trim()} onClick={check}>{busy ? "Checking" : "Check file"}</button>
            : <button type="button" className="btn btn-primary" disabled={busy || preview.valid === 0} onClick={apply}>{busy ? "Adding" : `Add ${preview.valid} ${preview.valid === 1 ? "person" : "people"}`}</button>}
        </div>
      </div>
    </dialog>
  );
}

export function DeptDialog({ dept, onDone, onClose }: { dept?: Department; onDone: () => void; onClose: () => void }) {
  const { err, busy, run } = useSubmit();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { name: String(f.get("name")).trim(), description: String(f.get("description") ?? "").trim() };
    run(() => (dept ? api(`/departments/${encodeURIComponent(dept.name)}`, body, "PATCH") : api("/departments", body)).then(onDone));
  }
  return (
    <dialog ref={openModal} className="dialog" aria-labelledby="dd-title" onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <div>
          <h2 id="dd-title" className="text-xl font-semibold">{dept ? `Rename ${dept.name}` : "New group"}</h2>
          <p className="text-sm text-muted">A group is also a document department: its people read documents filed under it.</p>
        </div>
        <label className="grid gap-1 text-sm font-medium">Name<input name="name" required className="field" defaultValue={dept?.name} autoComplete="off" /></label>
        <label className="grid gap-1 text-sm font-medium">Description<input name="description" className="field" defaultValue={dept?.description} autoComplete="off" /></label>
        {err && <p className="text-sm text-error" role="alert">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving" : "Save"}</button>
        </div>
      </form>
    </dialog>
  );
}
