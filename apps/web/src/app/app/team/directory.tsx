"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type Ref } from "react";
import { Region } from "@/components/region";
import { api } from "@/lib/api";
import { initials } from "@/lib/demo-users";
import { day, type ApiRole, type Person } from "@/lib/types";
import { cap, nf, ROLES, type BulkOut, type Filters, type Member, type PeoplePage, type Status } from "./types";

const PER_PAGE = 25;
const STATUS: Record<Status, [string, "success" | "info" | "warn"]> = {
  active: ["Active", "success"],
  invited: ["Not signed in yet", "info"],
  expired: ["Access ended", "warn"],
};

function query(f: Filters) {
  const p = new URLSearchParams({ page: String(f.page), per_page: String(PER_PAGE) });
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.role) p.set("role", f.role);
  if (f.dept) p.set("dept", f.dept);
  if (f.status) p.set("status", f.status);
  return `/team/people?${p}`;
}

/** The people directory: server-side search, filters and pages (25 a page), bulk changes on selected rows. */
export function Directory({ ref, filters, setFilters, isAdmin, me, groupNames, allGroups, onEdit, onChanged, onError }: {
  ref: Ref<HTMLElement>; filters: Filters; setFilters: (f: Filters) => void; isAdmin: boolean; me: string;
  groupNames: string[]; allGroups: string[];
  onEdit: (p: Person) => void; onChanged: (note: string) => void; onError: (msg: string) => void;
}) {
  // The search box answers as you type; the request waits for a 250 ms pause.
  const [text, setText] = useState(filters.q);
  const [lastQ, setLastQ] = useState(filters.q);
  if (filters.q !== lastQ) { setLastQ(filters.q); setText(filters.q); }
  useEffect(() => {
    if (text === filters.q) return;
    const t = setTimeout(() => setFilters({ ...filters, q: text, page: 1 }), 250);
    return () => clearTimeout(t);
  }, [text, filters, setFilters]);

  const list = useQuery({ queryKey: ["team-people", filters], queryFn: () => api<PeoplePage>(query(filters)), placeholderData: keepPreviousData });
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Filters>) => { setPicked(new Set()); setFilters({ ...filters, page: 1, ...patch }); };
  // Managers act only on members and guests of their groups (the API checks again); nobody changes themselves here.
  const canManage = (p: Person) => p.email !== me && (isAdmin || p.role === "member" || p.role === "guest");
  const rows = list.data?.people ?? [];
  const selectable = rows.filter(canManage);
  const allPicked = selectable.length > 0 && selectable.every((p) => picked.has(p.id));
  const filtered = Boolean(filters.q || filters.role || filters.dept || filters.status);

  function toggle(id: number) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  }

  async function remove(p: Person) {
    if (!confirm(`Remove ${p.name}? They lose access straight away.`)) return;
    try {
      await api(`/team/${p.id}`, undefined, "DELETE");
      onChanged(`${p.name} was removed.`);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function applyBulk() {
    const [kind, value] = [action.slice(0, action.indexOf(":")), action.slice(action.indexOf(":") + 1)];
    const body = { ids: [...picked], ...(kind === "role" ? { role: value } : kind === "add" ? { add_group: value } : { remove_group: value }) };
    setBusy(true);
    onError("");
    try {
      const r = await api<BulkOut>("/team/bulk", body);
      const skipped = r.errors.map((e) => `${e.name || `#${e.id}`}: ${e.error}`).join(" ");
      onChanged(`Changed ${r.changed} ${r.changed === 1 ? "person" : "people"}.${r.errors.length ? ` Skipped ${r.errors.length}. ${skipped}` : ""}`);
      setPicked(new Set());
      setAction("");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const from = total ? (filters.page - 1) * PER_PAGE + 1 : 0;
  const to = Math.min(total, filters.page * PER_PAGE);
  const bulkRoles: ApiRole[] = isAdmin ? ROLES : ["member", "guest"];

  return (
    <section ref={ref} className="block directory" aria-labelledby="people-h">
      <div className="block-head">
        <div>
          <h2 id="people-h">People</h2>
          <p>{isAdmin ? "Search the whole company. Tick people to change many at once." : "People in your groups. You can change members and guests."}</p>
        </div>
      </div>
      <div className="dir-filters" role="search">
        <label className="sr-only" htmlFor="t-q">Search people</label>
        <input id="t-q" type="search" className="field dir-q" placeholder="Search name, email or job title" value={text}
          onChange={(e) => setText(e.target.value)} autoComplete="off" />
        <label className="sr-only" htmlFor="t-role">Role</label>
        <select id="t-role" className="field" value={filters.role} onChange={(e) => set({ role: e.target.value })}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{cap(r)}s</option>)}
        </select>
        <label className="sr-only" htmlFor="t-dept">Group</label>
        <select id="t-dept" className="field" value={filters.dept} onChange={(e) => set({ dept: e.target.value })}>
          <option value="">All groups</option>
          {(isAdmin ? allGroups : groupNames).map((d) => <option key={d} value={d}>{d}</option>)}
          {isAdmin && <option value="-">In no group (Everyone only)</option>}
        </select>
        <label className="sr-only" htmlFor="t-status">Status</label>
        <select id="t-status" className="field" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">Any status</option>
          {(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s][0]}</option>)}
        </select>
        {filtered && <button type="button" className="link-btn" onClick={() => { setText(""); set({ q: "", role: "", dept: "", status: "" }); }}>Clear filters</button>}
      </div>

      {picked.size > 0 && (
        <div className="bulk-bar" role="region" aria-label="Change selected people">
          <strong>{picked.size} selected</strong>
          <label className="sr-only" htmlFor="t-bulk">Change</label>
          <select id="t-bulk" className="field" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Choose a change…</option>
            <optgroup label="Set role">{bulkRoles.map((r) => <option key={r} value={`role:${r}`}>Make {r}</option>)}</optgroup>
            <optgroup label="Add to group">{groupNames.map((d) => <option key={d} value={`add:${d}`}>Add to {d}</option>)}</optgroup>
            <optgroup label="Remove from group">{groupNames.map((d) => <option key={d} value={`remove:${d}`}>Remove from {d}</option>)}</optgroup>
          </select>
          <button type="button" className="btn btn-primary" disabled={!action || busy} onClick={applyBulk}>{busy ? "Applying" : "Apply"}</button>
          <button type="button" className="link-btn" onClick={() => setPicked(new Set())}>Clear selection</button>
        </div>
      )}

      <Region q={list} what="people list" rows={6} isEmpty={(d) => d.total === 0}
        empty={filtered
          ? <><p className="font-semibold">No one matches</p><p className="text-sm text-muted">Try another search or clear the filters.</p></>
          : <><p className="font-semibold">No people yet</p><p className="text-sm text-muted">Invite people to give them access.</p></>}>
        {() => (
          <>
            <div className="table-wrap" aria-busy={list.isFetching}>
              <table className="tbl dir-table">
                <thead>
                  <tr>
                    <th scope="col" className="pick">
                      <input type="checkbox" className="size-4 accent-accent" aria-label="Select everyone on this page" checked={allPicked}
                        disabled={!selectable.length}
                        onChange={() => setPicked(allPicked ? new Set() : new Set([...picked, ...selectable.map((p) => p.id)]))} />
                    </th>
                    <th scope="col">Name</th><th scope="col" className="hide-sm">Role</th><th scope="col" className="hide-sm">Groups</th>
                    <th scope="col" className="hide-sm">Status</th><th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => <Row key={p.id} p={p} manage={canManage(p)} picked={picked.has(p.id)} onPick={() => toggle(p.id)}
                    onEdit={() => onEdit(p)} onRemove={() => remove(p)} />)}
                </tbody>
              </table>
            </div>
            <nav className="pager" aria-label="People pages">
              <span className="text-sm text-muted" aria-live="polite">{nf.format(from)}–{nf.format(to)} of {nf.format(total)}</span>
              <span className="pager-btns">
                <button type="button" className="btn" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</button>
                <span className="text-sm">Page {filters.page} of {pages}</span>
                <button type="button" className="btn" disabled={filters.page >= pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button>
              </span>
            </nav>
          </>
        )}
      </Region>
    </section>
  );
}

function Row({ p, manage, picked, onPick, onEdit, onRemove }: {
  p: Member; manage: boolean; picked: boolean; onPick: () => void; onEdit: () => void; onRemove: () => void;
}) {
  const [label, tone] = STATUS[p.status] ?? STATUS.active;
  return (
    <tr aria-selected={picked || undefined}>
      <td className="pick">
        {manage && <input type="checkbox" className="size-4 accent-accent" checked={picked} onChange={onPick} aria-label={`Select ${p.name}`} />}
      </td>
      <td>
        <div className="person">
          <span className="avatar" aria-hidden="true">{initials(p.name)}</span>
          <div>
            <strong>{p.name}</strong>
            <span>{p.title ? <>{p.title}<span className="dir-email"> · {p.email}</span></> : p.email}</span>
            <span className="show-sm">{cap(p.role)} · {p.role === "admin" ? "All groups" : p.departments.join(", ") || "Everyone only"}</span>
          </div>
        </div>
      </td>
      <td className="hide-sm"><span className="role" data-role={p.role}>{cap(p.role)}</span></td>
      <td className="hide-sm text-ink-2">
        {p.role === "admin" ? "All groups" : p.departments.length ? p.departments.join(", ") : <span className="text-muted">Everyone only</span>}
        {p.guest_until && <span className="block text-xs text-muted">Until {day.format(new Date(p.guest_until))}</span>}
      </td>
      <td className="hide-sm">
        <span className="badge" data-tone={tone}><span className="dot" aria-hidden="true" />{label}</span>
        {p.last_active && <span className="block text-xs text-muted">{day.format(new Date(p.last_active))}</span>}
      </td>
      <td>{manage && (
        <div className="row-actions">
          <button type="button" className="btn" onClick={onEdit}>Edit<span className="sr-only"> {p.name}</span></button>
          <button type="button" className="btn" onClick={onRemove}>Remove<span className="sr-only"> {p.name}</span></button>
        </div>
      )}</td>
    </tr>
  );
}
