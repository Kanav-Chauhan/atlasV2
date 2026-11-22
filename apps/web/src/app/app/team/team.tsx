"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Region } from "@/components/region";
import { api } from "@/lib/api";
import { initials } from "@/lib/demo-users";
import { day, type Access, type ApiRole, type Department, type Person } from "@/lib/types";

type Props = { isAdmin: boolean; me: string; myDepts: string[] };
type Editing = { person?: Person; dept?: string } | null;

const ROLES: ApiRole[] = ["admin", "manager", "member", "guest"];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const Tick = () => (
  <span className="yes"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>Yes</span>
);

export function Team({ isAdmin, me, myDepts }: Props) {
  const client = useQueryClient();
  const team = useQuery({ queryKey: ["team"], queryFn: () => api<Person[]>("/team") });
  const access = useQuery({ queryKey: ["access"], queryFn: () => api<Access>("/access") });
  const depts = useQuery({ queryKey: ["departments"], queryFn: () => api<Department[]>("/departments") });
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [deptEdit, setDeptEdit] = useState<Department | "new" | null>(null);
  const [err, setErr] = useState("");

  // Managers act only on members and guests (the API scopes the list to their departments); nobody edits themselves here.
  const canManage = (p: Person) => p.email !== me && (isAdmin || p.role === "member" || p.role === "guest");
  // The shared Managers department is admin-managed; it never widens a manager's scope (access.team_scope).
  const scope = myDepts.filter((d) => d !== "Managers");
  const myDeptList = (depts.data ?? []).filter((d) => isAdmin || scope.includes(d.name));
  const deptNames = isAdmin ? (depts.data ?? []).map((d) => d.name) : scope;
  const refresh = () => ["team", "access", "departments"].forEach((k) => client.invalidateQueries({ queryKey: [k] }));

  async function act(fn: () => Promise<unknown>) {
    setErr("");
    try {
      await fn();
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const needle = q.trim().toLowerCase();
  const shown = (team.data ?? []).filter((p) => (!role || p.role === role) && `${p.name} ${p.email} ${p.title}`.toLowerCase().includes(needle));

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-[var(--gutter)] py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold">Team & access</h1>
          <p className="text-muted">A role sets what someone can do. Departments set what they can read.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>Add person</button>
      </header>
      {err && <p className="state text-sm text-error" role="alert">{err}</p>}

      <section className="block" aria-labelledby="people-h">
        <div className="block-head">
          <div>
            <h2 id="people-h">People</h2>
            <p>{isAdmin ? "Everyone in the company." : "People in your departments. You can add members and guests."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="t-q">Search people</label>
            <input id="t-q" type="search" className="field w-56" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
            <label className="sr-only" htmlFor="t-role">Role</label>
            <select id="t-role" className="field" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{cap(r)}</option>)}
            </select>
          </div>
        </div>
        <Region q={team} what="people list" rows={5}
          empty={<><p className="font-semibold">No people yet</p><p className="text-sm text-muted">Add someone to give them access.</p></>}>
          {() => shown.length ? (
            <PeopleTable people={shown} canManage={canManage}
              onEdit={(p) => setEditing({ person: p })}
              onRemove={(p) => confirm(`Remove ${p.name}? They lose access straight away.`) && act(() => api(`/team/${p.id}`, undefined, "DELETE"))} />
          ) : <p className="text-sm text-muted">No one matches this search.</p>}
        </Region>
      </section>

      <section className="block" aria-labelledby="grid-h">
        <div className="block-head"><div>
          <h2 id="grid-h">Who can read what</h2>
          <p>Each row is a person. A tick means they can open that department&apos;s documents.</p>
        </div></div>
        <Region q={access} what="access grid" rows={4} isEmpty={(d) => d.people.length === 0}
          empty={<p className="text-sm text-muted">No people to show yet.</p>}>
          {(d) => (
            <div className="table-wrap">
              <table className="tbl grid-table">
                <thead><tr><th scope="col">Person</th>{d.departments.map((x) => <th key={x} scope="col">{x}</th>)}<th scope="col">Everyone</th></tr></thead>
                <tbody>
                  {d.people.map((p) => (
                    <tr key={p.id}>
                      <th scope="row">{p.name}</th>
                      {d.departments.map((x) => <td key={x}>{p.can_read[x] ? <Tick /> : <span className="no">No</span>}</td>)}
                      <td>{p.everyone ? <Tick /> : <span className="no">No</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Region>
      </section>

      <section className="block" aria-labelledby="dept-h">
        <div className="block-head">
          <div>
            <h2 id="dept-h">Departments</h2>
            <p>{isAdmin ? "People in a department can read its documents." : "Your departments."}</p>
          </div>
          {isAdmin && <button type="button" className="btn" onClick={() => setDeptEdit("new")}>Add department</button>}
        </div>
        <Region q={depts} what="departments" rows={3} isEmpty={() => myDeptList.length === 0}
          empty={<><p className="font-semibold">No departments yet</p><p className="text-sm text-muted">{isAdmin ? "Add one, then add people to it." : "You are not in a department yet."}</p></>}>
          {() => (
            <ul className="list">
              {myDeptList.map((d) => (
                <li key={d.name} className="stack">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="grid min-w-0">
                      <span className="font-semibold">{d.name}</span>
                      {d.description && <span className="text-xs text-muted">{d.description}</span>}
                    </span>
                    <span className="row-actions items-center">
                      <span className="count">{d.members === 1 ? "1 person" : `${d.members} people`}</span>
                      {isAdmin && <button type="button" className="btn" onClick={() => setDeptEdit(d)}>Rename<span className="sr-only"> {d.name}</span></button>}
                      {isAdmin && (
                        <button type="button" className="btn" onClick={() => confirm(`Delete ${d.name}?`) && act(() => api(`/departments/${encodeURIComponent(d.name)}`, undefined, "DELETE"))}>
                          Delete<span className="sr-only"> {d.name}</span>
                        </button>
                      )}
                    </span>
                  </div>
                  {d.members === 0 && (
                    <div className="state">
                      <p className="text-sm font-semibold">No one is in {d.name} yet</p>
                      <p className="text-sm text-muted">Nobody can read {d.name} documents until someone joins.</p>
                      <button type="button" className="btn" onClick={() => setEditing({ dept: d.name })}>Add people</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Region>
      </section>

      {editing && <PersonDialog key={editing.person?.id ?? "new"} {...editing} isAdmin={isAdmin} deptNames={deptNames}
        onDone={() => { setEditing(null); refresh(); }} onClose={() => setEditing(null)} />}
      {deptEdit && <DeptDialog dept={deptEdit === "new" ? undefined : deptEdit} onDone={() => { setDeptEdit(null); refresh(); }} onClose={() => setDeptEdit(null)} />}
    </div>
  );
}

/** People table from option A. Without onEdit/onRemove it is read-only (super admin company view). */
export function PeopleTable({ people, canManage, onEdit, onRemove }: {
  people: Person[]; canManage?: (p: Person) => boolean; onEdit?: (p: Person) => void; onRemove?: (p: Person) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Departments</th><th scope="col" className="hide-sm">Last active</th>{onEdit && <th scope="col"><span className="sr-only">Actions</span></th>}</tr></thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td><div className="person"><span className="avatar" aria-hidden="true">{initials(p.name)}</span><div><strong>{p.name}</strong><span>{p.title || p.email}</span></div></div></td>
              <td><span className="role" data-role={p.role}>{cap(p.role)}</span></td>
              <td className="text-ink-2">
                {p.role === "admin" ? "All departments" : p.departments.join(", ") || "Everyone only"}
                {p.guest_until && <span className="block text-xs text-muted">Until {day.format(new Date(p.guest_until))}</span>}
              </td>
              <td className="hide-sm text-muted">{p.last_active ? day.format(new Date(p.last_active)) : "Not yet"}</td>
              {onEdit && (
                <td>{canManage?.(p) && (
                  <div className="row-actions">
                    <button type="button" className="btn" onClick={() => onEdit(p)}>Edit<span className="sr-only"> {p.name}</span></button>
                    <button type="button" className="btn" onClick={() => onRemove?.(p)}>Remove<span className="sr-only"> {p.name}</span></button>
                  </div>
                )}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Opens as a modal on mount; closing (Esc, Cancel) unmounts it.
const openModal = (d: HTMLDialogElement | null) => { if (d && !d.open) d.showModal(); };

function useSubmit(onDone: () => void) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr("");
    try {
      await fn();
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { err, busy, run };
}

function PersonDialog({ person, dept, isAdmin, deptNames, onDone, onClose }: {
  person?: Person; dept?: string; isAdmin: boolean; deptNames: string[]; onDone: () => void; onClose: () => void;
}) {
  const [role, setRole] = useState<ApiRole>(person?.role ?? "member");
  const { err, busy, run } = useSubmit(onDone);
  const roles: ApiRole[] = isAdmin ? ROLES : ["member", "guest"];
  const chosen = person?.departments ?? (dept ? [dept] : []);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      title: String(f.get("title") ?? "").trim(),
      role,
      departments: f.getAll("departments").map(String),
      guest_until: role === "guest" ? String(f.get("guest_until") || "") || null : null,
    };
    run(() => person
      ? api(`/team/${person.id}`, body, "PATCH")
      : api("/team", { ...body, name: String(f.get("name")).trim(), email: String(f.get("email")).trim() }));
  }

  return (
    <dialog ref={openModal} className="dialog" aria-labelledby="pd-title" onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <h2 id="pd-title" className="text-xl font-semibold">{person ? `Edit ${person.name}` : "Add a person"}</h2>
        {!person && (
          <>
            <label className="grid gap-1 text-sm font-medium">Name<input name="name" required className="field" autoComplete="off" /></label>
            <label className="grid gap-1 text-sm font-medium">Email<input name="email" type="email" required className="field" autoComplete="off" /></label>
          </>
        )}
        <label className="grid gap-1 text-sm font-medium">Job title<input name="title" className="field" defaultValue={person?.title} autoComplete="off" /></label>
        <label className="grid gap-1 text-sm font-medium">
          Role
          <select className="field" value={role} onChange={(e) => setRole(e.target.value as ApiRole)}>
            {roles.map((r) => <option key={r} value={r}>{cap(r)}</option>)}
          </select>
        </label>
        {role !== "admin" && (
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-medium">Departments</legend>
            {deptNames.length === 0 && <p className="text-sm text-muted">No departments yet.</p>}
            <div className="grid grid-cols-2 gap-1">
              {deptNames.map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="departments" value={d} defaultChecked={chosen.includes(d)} className="size-4 accent-accent" />{d}
                </label>
              ))}
            </div>
            {role === "guest" && <p className="text-xs text-muted">Guests read Everyone documents, plus any department ticked here.</p>}
          </fieldset>
        )}
        {role === "guest" && (
          <label className="grid gap-1 text-sm font-medium">
            Access until
            <input name="guest_until" type="date" className="field" defaultValue={person?.guest_until?.slice(0, 10)} />
          </label>
        )}
        {err && <p className="text-sm text-error" role="alert">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving" : person ? "Save" : "Add person"}</button>
        </div>
      </form>
    </dialog>
  );
}

function DeptDialog({ dept, onDone, onClose }: { dept?: Department; onDone: () => void; onClose: () => void }) {
  const { err, busy, run } = useSubmit(onDone);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { name: String(f.get("name")).trim(), description: String(f.get("description") ?? "").trim() };
    run(() => dept ? api(`/departments/${encodeURIComponent(dept.name)}`, body, "PATCH") : api("/departments", body));
  }
  return (
    <dialog ref={openModal} className="dialog" aria-labelledby="dd-title" onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <h2 id="dd-title" className="text-xl font-semibold">{dept ? `Rename ${dept.name}` : "Add a department"}</h2>
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
