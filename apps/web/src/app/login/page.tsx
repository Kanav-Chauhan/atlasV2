import type { Metadata } from "next";
import Link from "next/link";
import { loginAs } from "@/app/actions";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { DEMO_COMPANIES, type DemoCompany } from "@/lib/demo-users";

export const metadata: Metadata = { title: "Log in" };

// Demo login: pick a company, then a person (one click). Step lives in ?company= so no client state is needed.
// TODO(Phase 4/10): real auth (email login, then Clerk) replaces this picker for non-demo users.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const { company: slug } = await searchParams;
  const company = DEMO_COMPANIES.find((c) => c.slug === slug);

  return (
    <div className="flex min-h-dvh flex-col bg-paper-2">
      <div className="flex justify-end p-3">
        <ThemeToggle className="grid size-11 cursor-pointer place-items-center rounded-input text-muted hover:bg-paper-3 hover:text-ink" />
      </div>
      <main className="flex flex-1 items-start justify-center px-4 pt-[6vh] pb-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3">
            <Logo className="size-8 text-accent" />
            <div>
              <h1 className="text-lg font-semibold">Log in to Atlas</h1>
              <p className="text-sm text-muted">Try the demo as someone at a fictional company</p>
            </div>
          </div>
          <section aria-labelledby="demo-heading">{company ? <PersonPicker company={company} /> : <CompanyPicker />}</section>
        </div>
      </main>
    </div>
  );
}

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
    className="mt-0.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

function Monogram({ company, small }: { company: DemoCompany; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center font-semibold text-white ${small ? "size-7 rounded-[8px] text-xs" : "size-9 rounded-[10px] text-sm"}`}
      style={{ background: company.color, boxShadow: `inset 0 -3px 0 ${company.accent}` }}
    >
      {company.monogram}
    </span>
  );
}

function CompanyPicker() {
  return (
    <>
      <h2 id="demo-heading" className="mb-2 font-body text-xs font-medium text-muted">
        Demo · step 1 of 2 · Pick a company
      </h2>
      <ul className="overflow-hidden rounded-card border border-rule bg-paper">
        {DEMO_COMPANIES.map((c) => (
          <li key={c.slug} className="border-b border-rule last:border-b-0">
            <Link href={`/login?company=${c.slug}`} className="group flex items-center gap-3 px-4 py-3 hover:bg-paper-2">
              <Monogram company={c} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted">{c.industry}</span>
                </span>
                <span className="mt-0.5 block text-xs text-muted">{c.description}</span>
              </span>
              <Arrow />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Fictional companies with their own documents. Each person sees different departments.</p>
    </>
  );
}

function PersonPicker({ company }: { company: DemoCompany }) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="demo-heading" className="font-body text-xs font-medium text-muted">
          Demo · step 2 of 2 · Pick a person at {company.name}
        </h2>
        <Link href="/login" className="rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-paper-3 hover:text-ink">
          ← Companies
        </Link>
      </div>
      <div className="overflow-hidden rounded-card border border-rule bg-paper">
        <div className="flex items-center gap-3 border-b border-rule bg-paper-2 px-4 py-2.5">
          <Monogram company={company} small />
          <span className="text-sm font-medium">{company.name}</span>
          <span className="text-xs text-muted">{company.industry}</span>
        </div>
        <form action={loginAs}>
          <ul>
            {company.people.map((p) => (
              <li key={p.email} className="border-b border-rule last:border-b-0">
                <button
                  type="submit"
                  name="email"
                  value={p.email}
                  className="group flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left hover:bg-paper-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-muted">{p.title}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs leading-5 text-muted">
                      <span className="rounded-pill bg-accent-soft px-2 font-medium text-accent-deep">{p.role}</span>
                      {p.departments.join(", ")}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">{p.email}</span>
                  </span>
                  <Arrow />
                </button>
              </li>
            ))}
          </ul>
        </form>
      </div>
      <p className="mt-2 text-xs text-muted">Ask the same question as two people and compare the answers.</p>
    </>
  );
}
