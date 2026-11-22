"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PeopleTable } from "@/app/app/team/team";
import { Stats } from "@/app/app/insights/insights";
import { Region } from "@/components/region";
import { api } from "@/lib/api";
import { day, type Insights, type Org, type Person } from "@/lib/types";

// docs/API.md "Super admin": GET /super/orgs/{slug}/view.
type Snapshot = {
  org: Org;
  team: Person[];
  documents: { id: number; title: string; access: string; status: string; updated_at: string }[];
  insights: Insights;
};

export function OrgView({ slug }: { slug: string }) {
  const q = useQuery({ queryKey: ["super-org", slug], queryFn: () => api<Snapshot>(`/super/orgs/${encodeURIComponent(slug)}/view`) });

  return (
    <>
      <Link className="link justify-self-start" href="/super">All companies</Link>
      <Region q={q} what="company snapshot" rows={4} isEmpty={() => false} empty={null}>
        {({ org, team, documents, insights }) => (
          <>
            <header className="grid gap-1">
              <h1 className="text-3xl font-semibold">{org.name}</h1>
              <p className="text-muted">{[org.industry, org.description].filter(Boolean).join(". ")}</p>
              <p className="text-sm text-muted">Read-only view.</p>
            </header>
            <section className="block" aria-labelledby="ins-h">
              <div className="block-head"><h2 id="ins-h">Last 30 days</h2></div>
              <Stats d={insights} />
            </section>
            <section className="block" aria-labelledby="team-h">
              <div className="block-head"><h2 id="team-h">Team</h2></div>
              {team.length ? <PeopleTable people={team} /> : <div className="state"><p className="text-sm text-muted">No people yet.</p></div>}
            </section>
            <section className="block" aria-labelledby="docs-h">
              <div className="block-head"><h2 id="docs-h">Documents</h2></div>
              {documents.length ? (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead><tr><th scope="col">Title</th><th scope="col">Department</th><th scope="col" className="hide-sm">Status</th><th scope="col">Updated</th></tr></thead>
                    <tbody>
                      {documents.map((d) => (
                        <tr key={d.id}><th scope="row" className="font-normal">{d.title}</th><td>{d.access}</td><td className="hide-sm capitalize">{d.status}</td><td className="text-muted">{day.format(new Date(d.updated_at))}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="state"><p className="text-sm text-muted">No documents yet.</p></div>}
            </section>
          </>
        )}
      </Region>
    </>
  );
}
