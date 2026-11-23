"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Region } from "@/components/region";
import { Card, Page, PageHeader } from "@/components/ui/page";
import { api } from "@/lib/api";
import { type AutoJoin, type OrgSettings, type Profile, uploadImage } from "@/lib/profile";
import type { Department, Org } from "@/lib/types";
import { day } from "@/lib/types";
import { ImagePicker, pickError } from "./image-picker";

const SECTIONS = [
  { id: "profile", label: "Profile", note: "Your picture, name and job title", admin: false },
  { id: "company", label: "Company", note: "Name, logo and description", admin: true },
  { id: "access", label: "Access defaults", note: "What new people get", admin: true },
  { id: "plan", label: "Plan & usage", note: "Limits and what is used", admin: true },
  { id: "notifications", label: "Notifications", note: "Emails to admins", admin: true },
  { id: "danger", label: "Danger zone", note: "Reset and removal", admin: true },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const ROLE_LABEL: Record<string, string> = { admin: "Admin", manager: "Manager", member: "Member", guest: "Guest" };

export function Settings({ admin, demo }: { admin: boolean; demo: boolean }) {
  const params = useSearchParams();
  const sections = SECTIONS.filter((s) => admin || !s.admin);
  const asked = params.get("section");
  const current: SectionId = sections.find((s) => s.id === asked)?.id ?? "profile";
  const meta = sections.find((s) => s.id === current)!;

  return (
    <Page>
      <PageHeader title="Settings" description={admin ? "Your profile and how Atlas works for your company." : "Your profile: how you appear to colleagues in Atlas."} />
      <div className={`set-layout ${sections.length > 1 ? "" : "set-single"}`}>
        {sections.length > 1 && (
          <nav className="set-nav" aria-label="Settings sections">
            {sections.map((s) => (
              <Link key={s.id} href={`/app/settings?section=${s.id}`} scroll={false} replace aria-current={s.id === current ? "page" : undefined}>
                <span>{s.label}</span>
                <small>{s.note}</small>
              </Link>
            ))}
          </nav>
        )}
        <div className="set-body" aria-label={meta.label} role="region">
          {current === "profile" && <ProfileSection />}
          {current === "company" && <CompanySection />}
          {current === "access" && <AccessSection />}
          {current === "plan" && <PlanSection />}
          {current === "notifications" && <NotificationsSection />}
          {current === "danger" && <DangerSection demo={demo} />}
        </div>
      </div>
    </Page>
  );
}

function Status({ m, done = "Saved." }: { m: { isError: boolean; isSuccess: boolean; error: Error | null }; done?: string }) {
  return (
    <p role="status" className={`text-sm ${m.isError ? "text-error" : "text-muted"}`}>
      {m.isError ? m.error?.message : m.isSuccess ? done : ""}
    </p>
  );
}

// ------------------------------------------------------------------ picture upload (profile + logo)

function PictureField({ label, current, fallback, mode, upload, remove }: {
  label: string; current: string | null; fallback: React.ReactNode; mode: "cover" | "contain";
  upload: (blob: Blob, name: string) => Promise<void>; remove: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [removing, setRemoving] = useState(false);
  const hint = useId();

  function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const why = pickError(f);
    if (why) setMsg({ text: why, error: true });
    else { setMsg(null); setFile(f); }
  }

  return (
    <div className="pic-field">
      <div className={`pic-preview ${mode === "cover" ? "pic-round" : ""}`}>
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, same-origin API image
          <img src={current} alt={label} width={96} height={96} />
        ) : fallback}
      </div>
      <div className="grid content-start gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => input.current?.click()} aria-describedby={hint}>
            {current ? "Change" : "Upload"} {mode === "cover" ? "picture" : "logo"}
          </button>
          {current && (
            <button type="button" className="btn" disabled={removing} onClick={async () => {
              setRemoving(true);
              try { await remove(); setMsg({ text: "Removed.", error: false }); } catch (e) { setMsg({ text: (e as Error).message, error: true }); }
              setRemoving(false);
            }}>{removing ? "Removing" : "Remove"}</button>
          )}
        </div>
        <p id={hint} className="text-xs text-muted">PNG, JPEG or WebP. Atlas keeps a 256 × 256 copy on its own server, visible only to people in your company.</p>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label={`Choose ${label}`} onChange={choose} />
        {msg && <p role="status" className={`text-sm ${msg.error ? "text-error" : "text-muted"}`}>{msg.text}</p>}
      </div>
      {file && (
        <ImagePicker file={file} mode={mode} title={mode === "cover" ? "Frame your picture" : "Check your logo"}
          onCancel={() => setFile(null)}
          onDone={async (blob, name) => { await upload(blob, name); setFile(null); setMsg({ text: "Saved.", error: false }); }} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ profile (everyone)

function ProfileSection() {
  const client = useQueryClient();
  const router = useRouter();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api<Profile>("/profile", undefined, "GET") });
  const save = useMutation({
    mutationFn: (body: { name: string; title: string }) => api<Profile>("/profile", body, "PATCH"),
    onSuccess: (p) => { client.setQueryData(["profile"], p); router.refresh(); },
  });
  const set = (p: Profile) => { client.setQueryData(["profile"], p); router.refresh(); };

  return (
    <Region q={profile} what="profile" rows={4} isEmpty={() => false} empty={null}>
      {(p) => (
        <>
          <Card title="Profile picture" note="Shown next to your name in the sidebar, the team list and agent tokens.">
            <PictureField label="Your profile picture" current={p.avatar_url} mode="cover"
              fallback={<Avatar name={p.name} className="pic-initials" />}
              upload={async (blob, name) => set(await uploadImage<Profile>("/profile/avatar", blob, name))}
              remove={async () => { await api("/profile/avatar", undefined, "DELETE"); set({ ...p, avatar_url: null }); }} />
          </Card>
          <Card title="Your details">
            <form className="set-form" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save.mutate({ name: String(f.get("name")).trim(), title: String(f.get("title")).trim() });
            }}>
              <label className="grid gap-1 text-sm font-medium">Name<input name="name" required maxLength={200} className="field" defaultValue={p.name} autoComplete="name" /></label>
              <label className="grid gap-1 text-sm font-medium">Job title<input name="title" maxLength={200} className="field" defaultValue={p.title} placeholder="For example, HR Manager" autoComplete="organization-title" /></label>
              <div className="flex items-center gap-3">
                <button type="submit" className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Saving" : "Save"}</button>
                <Status m={save} />
              </div>
            </form>
            <dl className="set-facts">
              <div><dt>Email</dt><dd>{p.email}</dd></div>
              <div><dt>Role</dt><dd><span className="role" data-role={p.role}>{ROLE_LABEL[p.role]}</span></dd></div>
              <div><dt>Groups</dt><dd>{p.departments.length ? p.departments.join(", ") : "Everyone only"}</dd></div>
              {p.guest_until && <div><dt>Guest access until</dt><dd>{day.format(new Date(p.guest_until))}</dd></div>}
            </dl>
            <p className="text-xs text-muted">Your email, role and groups are set by an admin on the Team page.</p>
          </Card>
        </>
      )}
    </Region>
  );
}

// ------------------------------------------------------------------ company (admin)

function CompanySection() {
  const client = useQueryClient();
  const router = useRouter();
  const org = useQuery({ queryKey: ["org"], queryFn: () => api<Org>("/org", undefined, "GET") });
  const settings = useQuery({ queryKey: ["org-settings"], queryFn: () => api<OrgSettings>("/org/settings", undefined, "GET") });
  const save = useMutation({
    mutationFn: (body: Omit<Org, "slug">) => api<Org>("/org", body, "PATCH"),
    onSuccess: (o) => { client.setQueryData(["org"], o); router.refresh(); },
  });
  const setLogo = (s: OrgSettings) => { client.setQueryData(["org-settings"], s); router.refresh(); };

  return (
    <>
      <Card title="Company logo" note="Shown at the top of the sidebar for everyone in your company.">
        <Region q={settings} what="logo" rows={1} isEmpty={() => false} empty={null}>
          {(s) => (
            <PictureField label="Company logo" current={s.logo_url} mode="contain"
              fallback={<span className="pic-mono" aria-hidden="true">{org.data?.name.slice(0, 1) ?? ""}</span>}
              upload={async (blob, name) => setLogo(await uploadImage<OrgSettings>("/org/logo", blob, name))}
              remove={async () => { await api("/org/logo", undefined, "DELETE"); setLogo({ ...s, logo_url: null }); }} />
          )}
        </Region>
      </Card>
      <Card title="About the company" note="How Atlas names and describes your company.">
        <Region q={org} what="company settings" rows={3} isEmpty={() => false} empty={null}>
          {(o) => (
            <form className="set-form" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save.mutate({ name: String(f.get("name")).trim(), industry: String(f.get("industry")).trim(), description: String(f.get("description")).trim() });
            }}>
              <div className="set-two">
                <label className="grid gap-1 text-sm font-medium">Company name<input name="name" required maxLength={200} className="field" defaultValue={o.name} /></label>
                <label className="grid gap-1 text-sm font-medium">Industry<input name="industry" maxLength={200} className="field" defaultValue={o.industry} placeholder="For example, IT services" /></label>
              </div>
              <label className="grid gap-1 text-sm font-medium">
                Description
                <textarea name="description" rows={4} maxLength={2000} className="field py-2" defaultValue={o.description} />
                <span className="font-normal text-xs text-muted">One or two sentences about what the company does.</span>
              </label>
              <p className="text-sm text-muted">Company address: <span className="font-mono">{o.slug}</span></p>
              <div className="flex items-center gap-3">
                <button type="submit" className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Saving" : "Save"}</button>
                <Status m={save} />
              </div>
            </form>
          )}
        </Region>
      </Card>
    </>
  );
}

// ------------------------------------------------------------------ access defaults (admin)

function GroupChecks({ name, groups, selected, skip = [] }: { name: string; groups: Department[]; selected: string[]; skip?: string[] }) {
  const shown = groups.filter((g) => g.name !== "Everyone" && !skip.includes(g.name));
  if (!shown.length) return <p className="text-sm text-muted">No groups yet. Add them on the Team page.</p>;
  return (
    <div className="set-checks">
      {shown.map((g) => (
        <label key={g.name} className="set-check">
          <input type="checkbox" name={name} value={g.name} defaultChecked={selected.includes(g.name)} />
          <span>{g.name}</span>
        </label>
      ))}
    </div>
  );
}

function AccessSection() {
  const client = useQueryClient();
  const settings = useQuery({ queryKey: ["org-settings"], queryFn: () => api<OrgSettings>("/org/settings", undefined, "GET") });
  const groups = useQuery({ queryKey: ["departments"], queryFn: () => api<Department[]>("/departments", undefined, "GET") });
  const save = useMutation({
    mutationFn: (body: Partial<OrgSettings>) => api<OrgSettings>("/org/settings", body, "PATCH"),
    onSuccess: (s) => client.setQueryData(["org-settings"], s),
  });

  return (
    <>
      <Card title="New people" note="Pre-chosen when someone is added to the company. You can still change them for each person.">
        <Region q={settings} what="access defaults" rows={3} isEmpty={() => false} empty={null}>
          {(s) => (
            <form className="set-form" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save.mutate({
                access_defaults: {
                  role: String(f.get("role")) as OrgSettings["access_defaults"]["role"],
                  departments: f.getAll("departments").map(String),
                  guest_days: Number(f.get("guest_days")),
                },
              });
            }}>
              <div className="set-two">
                <label className="grid gap-1 text-sm font-medium">
                  Default role
                  <select name="role" className="field" defaultValue={s.access_defaults.role}>
                    <option value="member">Member</option>
                    <option value="guest">Guest (until a date)</option>
                    <option value="manager">Manager (manages their groups)</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Guest access lasts
                  <span className="set-suffix"><input name="guest_days" type="number" min={1} max={365} required className="field" defaultValue={s.access_defaults.guest_days} /><span>days</span></span>
                </label>
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Default groups</legend>
                {groups.data ? <GroupChecks name="departments" groups={groups.data} selected={s.access_defaults.departments} /> : <div className="skeleton" />}
                <p className="text-xs text-muted">Everyone always sees documents shared with Everyone.</p>
              </fieldset>
              <div className="flex items-center gap-3">
                <button type="submit" className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Saving" : "Save"}</button>
                <Status m={save} />
              </div>
            </form>
          )}
        </Region>
      </Card>
      <AutoJoinCard groups={groups.data} />
    </>
  );
}

function AutoJoinCard({ groups }: { groups?: Department[] }) {
  const client = useQueryClient();
  const auto = useQuery({
    queryKey: ["auto-join"], retry: false,
    queryFn: async () => {
      try {
        return await api<AutoJoin>("/org/auto-join", undefined, "GET");
      } catch (e) {
        if ((e as { status?: number }).status === 404) return null; // API not deployed yet
        throw e;
      }
    },
  });
  const save = useMutation({
    mutationFn: (body: Partial<AutoJoin>) => api<AutoJoin>("/org/auto-join", body, "PATCH"),
    onSuccess: (a) => client.setQueryData(["auto-join"], a),
  });

  return (
    <Card title="Email-domain auto-join" note="People who sign in with a work email at your domain join this company on their own, without an invitation.">
      <Region q={auto} what="auto-join settings" rows={2} isEmpty={() => false} empty={null}>
        {(a) => !a ? (
          <div className="state"><p className="text-sm font-semibold">Coming soon</p><p className="text-sm text-muted">Auto-join is being built. Until then, add people on the Team page.</p></div>
        ) : !a.available ? (
          <div className="state">
            <p className="text-sm font-semibold">Not available in the demo</p>
            <p className="text-sm text-muted">Demo companies use made-up email addresses, so nobody can sign in with them. In a real company, an admin turns on their own email domain (like acme.com) here.</p>
          </div>
        ) : (
          <form className="set-form" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({ domains: f.getAll("domains").map(String), role: String(f.get("role")) as AutoJoin["role"], departments: f.getAll("aj_departments").map(String) });
          }}>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Domains</legend>
              {a.allowed_domains.length ? (
                <div className="set-checks">
                  {a.allowed_domains.map((d) => (
                    <label key={d} className="set-check"><input type="checkbox" name="domains" value={d} defaultChecked={a.domains.includes(d)} /><span>@{d}</span></label>
                  ))}
                </div>
              ) : <p className="text-sm text-muted">None available: only a company domain an admin here signs in with can be used (not Gmail, Outlook and the like).</p>}
              <p className="text-xs text-muted">Only domains your admins sign in with. A domain can belong to one company.</p>
            </fieldset>
            <label className="grid max-w-sm gap-1 text-sm font-medium">
              They join as
              <select name="role" className="field" defaultValue={a.role}>
                <option value="member">Member</option>
                <option value="guest">Guest</option>
              </select>
            </label>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">In these groups</legend>
              {groups ? <GroupChecks name="aj_departments" groups={groups} selected={a.departments} skip={["Managers"]} /> : <div className="skeleton" />}
            </fieldset>
            <div className="flex items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Saving" : "Save"}</button>
              <Status m={save} done={a.domains.length ? "Saved. Auto-join is on." : "Saved. Auto-join is off."} />
            </div>
          </form>
        )}
      </Region>
    </Card>
  );
}

// ------------------------------------------------------------------ plan & usage (admin)

type Plan = {
  plan: string;
  questions_month: number | null; questions_used: number;
  documents: number | null; documents_used: number;
  people: number | null; people_used: number;
};
const PLAN_NAMES: Record<string, string> = { demo: "Demo", pro: "Pro", enterprise: "Enterprise" };
const PLAN_NOTES: Record<string, string> = {
  demo: "A shared demo company. Each visitor can ask 40 questions a day.",
  pro: "Questions start again on the 1st of every month.",
  enterprise: "No limits.",
};
const num = new Intl.NumberFormat("en-IN");

function PlanSection() {
  const plan = useQuery({ queryKey: ["org-plan"], queryFn: () => api<Plan>("/org/plan", undefined, "GET") });
  return (
    <Region q={plan} what="plan" rows={3} isEmpty={() => false} empty={null}>
      {(p) => (
        <Card title={<>Plan: {PLAN_NAMES[p.plan] ?? p.plan}</>} note={PLAN_NOTES[p.plan]}>
          <div className="meters">
            <Meter label={p.plan === "demo" ? "Questions this month (all visitors)" : "Questions this month"} used={p.questions_used} cap={p.questions_month} />
            <Meter label="Documents" used={p.documents_used} cap={p.documents} />
            <Meter label="People" used={p.people_used} cap={p.people} />
          </div>
        </Card>
      )}
    </Region>
  );
}

function Meter({ label, used, cap }: { label: string; used: number; cap: number | null }) {
  const pct = cap ? Math.min(100, (used / Math.max(cap, 1)) * 100) : 0;
  const tone = pct >= 90 ? "error" : pct >= 75 ? "warn" : "accent";
  return (
    <div className="meter" data-tone={tone}>
      <p className="meter-label">{label}</p>
      <p className="meter-num">{num.format(used)}{cap != null && <small>{` of ${num.format(cap)}`}</small>}</p>
      {/* No limit: an empty bar in the same slot, so every tile has the same rows and height. */}
      {cap != null ? (
        <div className="meter-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={cap} aria-valuenow={used}>
          <div style={{ width: `${pct}%` }} />
        </div>
      ) : <div className="meter-bar" data-open="" aria-hidden="true" />}
      <p className="meter-left">{cap == null ? "No limit" : pct >= 100 ? "Limit reached" : `${num.format(Math.max(0, cap - used))} left`}</p>
    </div>
  );
}

// ------------------------------------------------------------------ notifications (admin)

function NotificationsSection() {
  const client = useQueryClient();
  const settings = useQuery({ queryKey: ["org-settings"], queryFn: () => api<OrgSettings>("/org/settings", undefined, "GET") });
  const save = useMutation({
    mutationFn: (n: Partial<OrgSettings["notifications"]>) => api<OrgSettings>("/org/settings", { notifications: n }, "PATCH"),
    onSuccess: (s) => client.setQueryData(["org-settings"], s),
  });
  const items = [
    { key: "weekly_summary", label: "Weekly summary", text: "Every Monday: questions asked, answers not found and the most used documents." },
    { key: "review_reminders", label: "Needs-review reminders", text: "When a document passes its review date or is more than a year old." },
  ] as const;

  return (
    <Card title="Emails to admins" note="Choose what admins should get by email.">
      <div className="state set-honest" role="note">
        <p className="text-sm"><strong>Saved only, not sent yet.</strong> Atlas remembers these choices, but email sending isn&apos;t switched on yet. Nothing is emailed until it is.</p>
      </div>
      <Region q={settings} what="notification settings" rows={2} isEmpty={() => false} empty={null}>
        {(s) => (
          <ul className="set-toggles">
            {items.map((i) => (
              <li key={i.key}>
                <div><p className="font-semibold text-sm">{i.label}</p><p className="text-sm text-muted">{i.text}</p></div>
                <label className="switch">
                  <input type="checkbox" role="switch" checked={s.notifications[i.key]} disabled={save.isPending}
                    onChange={(e) => save.mutate({ [i.key]: e.target.checked })} />
                  <span aria-hidden="true" />
                  <span className="sr-only">{i.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Region>
      <Status m={save} />
    </Card>
  );
}

// ------------------------------------------------------------------ danger zone (admin)

function DangerSection({ demo }: { demo: boolean }) {
  const [sure, setSure] = useState(false);
  const reset = useMutation({ mutationFn: () => api<{ status: string }>("/demo/reset", {}) });
  if (!demo) {
    return (
      <Card title="Danger zone" tone="error">
        <p className="text-sm text-muted">Nothing here yet. Removing your company and all its documents will come later; until then, ask the Atlas team.</p>
      </Card>
    );
  }
  return (
    <Card title="Reset demo" tone="error" note="Puts this demo company back to how it started.">
      <p className="text-sm text-ink-2">
        The original documents, people, groups and settings come back. Uploaded documents, chats, agent tokens, profile pictures and the
        logo are deleted. This also happens every night at 3 am (IST).
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {!sure ? (
          <button type="button" className="btn" onClick={() => setSure(true)} disabled={reset.isPending || reset.isSuccess}>Reset demo</button>
        ) : (
          <>
            <button type="button" className="btn btn-danger" onClick={() => { setSure(false); reset.mutate(); }}>Yes, reset it</button>
            <button type="button" className="btn" onClick={() => setSure(false)}>Cancel</button>
          </>
        )}
        <p role="status" className={`text-sm ${reset.isError ? "text-error" : "text-muted"}`}>
          {reset.isError ? reset.error.message : reset.isSuccess ? "Resetting. It takes a minute or two; reload the page after that." : ""}
        </p>
      </div>
    </Card>
  );
}
