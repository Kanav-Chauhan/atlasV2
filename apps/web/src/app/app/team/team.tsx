"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import { Page, PageHeader } from "@/components/ui/page";
import { api } from "@/lib/api";
import { initials } from "@/lib/demo-users";
import { day, type Department, type Person } from "@/lib/types";
import { Directory } from "./directory";
import { DeptDialog, ImportDialog, InviteDialog, PersonDialog } from "./dialogs";
import { GroupCards, RoleSummary } from "./groups";
import { cap, type AutoJoin, type Filters, type Groups } from "./types";

// Team & access for companies of any size (UI phase 5, docs/DECISIONS.md "Team for big companies"):
// groups first (a group = a department: its people read its documents + Everyone), then a server-side
// paged people directory with bulk changes. Nothing here loads the whole company.

type Props = { isAdmin: boolean; me: string; myDepts: string[] };
type Dialog =
  | { kind: "edit"; person: Person }
  | { kind: "invite"; dept?: string }
  | { kind: "import" }
  | { kind: "dept"; dept?: Department }
  | null;

export const EMPTY: Filters = { q: "", role: "", dept: "", status: "", page: 1 };

export function Team({ isAdmin, me, myDepts }: Props) {
  const client = useQueryClient();
  const groups = useQuery({ queryKey: ["team-groups"], queryFn: () => api<Groups>("/team/groups") });
  const depts = useQuery({ queryKey: ["departments"], queryFn: () => api<Department[]>("/departments") });
  const autoJoin = useQuery({ queryKey: ["auto-join"], queryFn: () => api<AutoJoin>("/org/auto-join"), enabled: isAdmin });
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const directory = useRef<HTMLElement>(null);

  // The shared Managers group is admin-managed; it never widens a manager's scope (access.team_scope).
  const scope = myDepts.filter((d) => d !== "Managers");
  const groupNames = isAdmin ? (depts.data ?? []).map((d) => d.name) : scope;
  const refresh = () => ["team-groups", "team-people", "departments", "team"].forEach((k) => client.invalidateQueries({ queryKey: [k] }));
  const close = () => setDialog(null);
  const done = (msg = "") => { setDialog(null); setNote(msg); refresh(); };

  function showPeople(next: Partial<Filters>) {
    setFilters({ ...EMPTY, ...next });
    directory.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    directory.current?.querySelector<HTMLInputElement>("input[type=search]")?.focus({ preventScroll: true });
  }

  async function removeDept(name: string) {
    if (!confirm(`Delete the ${name} group?`)) return;
    setErr("");
    try {
      await api(`/departments/${encodeURIComponent(name)}`, undefined, "DELETE");
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const aj = autoJoin.data;
  return (
    <Page className="team">
      <PageHeader
        title="Team & access"
        description="Access is given to groups. A role sets what someone can do; their groups set what they can read."
        actions={<>
          {isAdmin && aj?.available && (
            <Link href="/app/settings#auto-join" className="aj-chip" title="People who sign in with this email domain join automatically">
              <span className="dot" data-tone={aj.domains.length ? "success" : undefined} aria-hidden="true" />
              {aj.domains.length ? `Auto-join: ${aj.domains.map((d) => `@${d}`).join(", ")}` : "Auto-join off"}
            </Link>
          )}
          <button type="button" className="btn" onClick={() => setDialog({ kind: "import" })}>Import CSV</button>
          <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: "invite" })}>Invite people</button>
        </>}
      />
      {err && <p className="state text-sm text-error" role="alert">{err}</p>}
      {note && (
        <p className="team-note" role="status">
          {note}
          <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setNote("")}>×</button>
        </p>
      )}

      <RoleSummary q={groups} onRole={(role) => showPeople({ role })} />

      <GroupCards q={groups} isAdmin={isAdmin} depts={depts.data ?? []}
        onPeople={(dept) => showPeople({ dept })}
        onInvite={(dept) => setDialog({ kind: "invite", dept })}
        onRename={(d) => setDialog({ kind: "dept", dept: d })}
        onDelete={removeDept}
        onAdd={() => setDialog({ kind: "dept" })} />

      <Directory ref={directory} filters={filters} setFilters={setFilters} isAdmin={isAdmin} me={me}
        groupNames={groupNames} allGroups={(depts.data ?? []).map((d) => d.name)}
        onEdit={(person) => setDialog({ kind: "edit", person })}
        onChanged={(msg) => { setNote(msg); refresh(); }} onError={setErr} />

      {dialog?.kind === "edit" && <PersonDialog person={dialog.person} isAdmin={isAdmin} groupNames={groupNames} onDone={() => done()} onClose={close} />}
      {dialog?.kind === "invite" && <InviteDialog dept={dialog.dept} isAdmin={isAdmin} groupNames={groupNames} onDone={done} onClose={close} />}
      {dialog?.kind === "import" && <ImportDialog isAdmin={isAdmin} groupNames={groupNames} onDone={done} onClose={close} />}
      {dialog?.kind === "dept" && <DeptDialog dept={dialog.dept} onDone={() => done()} onClose={close} />}
    </Page>
  );
}

/** Read-only people table (super admin company view). */
export function PeopleTable({ people }: { people: Person[] }) {
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Groups</th><th scope="col" className="hide-sm">Last active</th></tr></thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td><div className="person"><span className="avatar" aria-hidden="true">{initials(p.name)}</span><div><strong>{p.name}</strong><span>{p.title || p.email}</span></div></div></td>
              <td><span className="role" data-role={p.role}>{cap(p.role)}</span></td>
              <td className="text-ink-2">{p.role === "admin" ? "All groups" : p.departments.join(", ") || "Everyone only"}</td>
              <td className="hide-sm text-muted">{p.last_active ? day.format(new Date(p.last_active)) : "Not yet"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
