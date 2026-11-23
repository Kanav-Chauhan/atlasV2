"use client";

import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Region } from "@/components/region";
import { Icon } from "@/components/ui/icons";
import type { ApiRole, Department } from "@/lib/types";
import { nf, people, type Group, type Groups } from "./types";

const ROLE_NOTE: Record<ApiRole, [string, string]> = {
  admin: ["Admins", "Manage everything, read every document"],
  manager: ["Managers", "Manage the members of their groups"],
  member: ["Members", "Read their groups' documents"],
  guest: ["Guests", "Like members, until an end date"],
};

/** Admins n · Managers n · Members n · Guests n. Each tile filters the directory by that role. */
export function RoleSummary({ q, onRole }: { q: UseQueryResult<Groups>; onRole: (role: ApiRole) => void }) {
  return (
    <Region q={q} what="role summary" rows={1} isEmpty={() => false} empty={null}>
      {(g) => (
        <div className="role-tiles" role="group" aria-label="People by role">
          {(Object.keys(ROLE_NOTE) as ApiRole[]).map((r) => (
            <button key={r} type="button" className="role-tile" onClick={() => onRole(r)}>
              <span className="role-tile-label">{ROLE_NOTE[r][0]}</span>
              <span className="role-tile-n">{nf.format(g.roles[r] ?? 0)}</span>
              <span className="role-tile-note">{ROLE_NOTE[r][1]}</span>
            </button>
          ))}
        </div>
      )}
    </Region>
  );
}

function docs(n: number) {
  return `${nf.format(n)} ${n === 1 ? "document" : "documents"}`;
}

export function GroupCards({ q, isAdmin, depts, onPeople, onInvite, onRename, onDelete, onAdd }: {
  q: UseQueryResult<Groups>; isAdmin: boolean; depts: Department[];
  onPeople: (dept: string) => void; onInvite: (dept: string) => void;
  onRename: (d: Department) => void; onDelete: (name: string) => void; onAdd: () => void;
}) {
  return (
    <section className="block-plain" aria-labelledby="groups-h">
      <div className="block-head">
        <div>
          <h2 id="groups-h">Groups</h2>
          <p>{isAdmin
            ? "Each group reads its own documents plus Everyone documents. Put people in groups; they get the group's access."
            : "Your groups. People in a group read its documents plus Everyone documents."}</p>
        </div>
        {isAdmin && <button type="button" className="btn" onClick={onAdd}>New group</button>}
      </div>
      <Region q={q} what="groups" rows={3} isEmpty={() => false} empty={null}>
        {(g) => (
          <ul className="group-grid">
            <EveryoneCard g={g} isAdmin={isAdmin} onPeople={onPeople} />
            {g.groups.map((x) => (
              <GroupCard key={x.name} g={x} isAdmin={isAdmin} dept={depts.find((d) => d.name === x.name)}
                onPeople={onPeople} onInvite={onInvite} onRename={onRename} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </Region>
    </section>
  );
}

/** Phones only (team.css shows it under 40rem): the card collapses to name, people and reads; a tap on the head expands it. */
function Expand({ name, open, onToggle }: { name: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="group-toggle" aria-expanded={open} onClick={onToggle}>
      <span className="sr-only">{open ? "Hide" : "Show"} details for {name}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
}

function EveryoneCard({ g, isAdmin, onPeople }: { g: Groups; isAdmin: boolean; onPeople: (dept: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="group-card" data-everyone="" data-open={open || undefined}>
      <div className="group-top">
        <h3>Everyone</h3>
        <span className="badge">{people(g.everyone.people)}</span>
        <Expand name="Everyone" open={open} onToggle={() => setOpen(!open)} />
      </div>
      <p className="group-desc">{isAdmin ? "Every person is in it, guests too. It can't be removed." : "Everyone in your groups also reads Everyone documents."}</p>
      <dl className="group-facts">
        <div className="group-reads"><dt>Reads</dt><dd><span className="read-chip">Everyone · {docs(g.everyone.documents)}</span></dd></div>
        {g.no_group > 0 && <div><dt>In no other group</dt><dd>{people(g.no_group)}</dd></div>}
      </dl>
      <div className="group-actions">
        <button type="button" className="btn" onClick={() => onPeople("")}>See people<Icon name="arrowRight" /></button>
      </div>
    </li>
  );
}

function GroupCard({ g, isAdmin, dept, onPeople, onInvite, onRename, onDelete }: {
  g: Group; isAdmin: boolean; dept?: Department;
  onPeople: (dept: string) => void; onInvite: (dept: string) => void;
  onRename: (d: Department) => void; onDelete: (name: string) => void;
}) {
  const managers = g.managers.join(", ") + (g.managers_more ? ` and ${g.managers_more} more` : "");
  const [open, setOpen] = useState(false);
  return (
    <li className="group-card" data-open={open || undefined}>
      <div className="group-top">
        <h3>{g.name}</h3>
        <span className="badge" data-tone={g.people ? undefined : "warn"}>{people(g.people)}</span>
        <Expand name={g.name} open={open} onToggle={() => setOpen(!open)} />
      </div>
      {g.description && <p className="group-desc">{g.description}</p>}
      <dl className="group-facts">
        <div className="group-reads">
          <dt>Reads</dt>
          <dd className="read-chips">
            <span className="read-chip" data-own="">{g.name} · {docs(g.documents)}</span>
            <span className="read-chip">Everyone</span>
          </dd>
        </div>
        <div><dt>Managers</dt><dd>{managers || <span className="text-muted">No manager</span>}</dd></div>
      </dl>
      {g.people === 0 && <p className="group-warn">Nobody can read {g.name} documents until someone joins.</p>}
      <div className="group-actions">
        <button type="button" className="btn" onClick={() => onPeople(g.name)}>See people<span className="sr-only"> in {g.name}</span><Icon name="arrowRight" /></button>
        <button type="button" className="btn" onClick={() => onInvite(g.name)}>Invite<span className="sr-only"> to {g.name}</span></button>
        {isAdmin && dept && (
          <span className="group-admin">
            <button type="button" className="link-btn" onClick={() => onRename(dept)}>Rename<span className="sr-only"> {g.name}</span></button>
            <button type="button" className="link-btn" onClick={() => onDelete(g.name)}>Delete<span className="sr-only"> {g.name}</span></button>
          </span>
        )}
      </div>
    </li>
  );
}
