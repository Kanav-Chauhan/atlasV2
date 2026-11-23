import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loginAs } from "@/app/actions";
import { MaybeClerk } from "@/components/clerk-provider";
import { AccessPanel } from "./access-panel";
import { Logo } from "@/components/logo";
import { CompanyLogo } from "@/components/company-logo";
import { BackHome } from "@/components/auth-frame";
import { ThemeToggle } from "@/components/theme-toggle";
import { OwnerForm } from "./owner-form";
import { CLERK_ON } from "@/lib/clerk";
import { DEMO_COMPANIES, type DemoCompany, type Role } from "@/lib/demo-users";

export const metadata: Metadata = { title: "Log in" };

// Everything on one page: Join waitlist / Sign in tabs with Clerk's own boxes (access-panel.tsx) on the
// left, the demo on the right. There is no /sign-in or /waitlist page (docs/DECISIONS.md D-047);
// /sign-up stays because Clerk invitation emails link to it.
// Demo: company tabs (?company=, default the first) and a one-click grid of people grouped by role.
// /login?owner=1 = backup owner login (email + password), not linked.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ company?: string; owner?: string }> }) {
  const { company: slug, owner } = await searchParams;
  const company = DEMO_COMPANIES.find((c) => c.slug === slug) ?? DEMO_COMPANIES[0];

  return (
    <div className="flex min-h-dvh flex-col bg-paper-2">
      <div className="flex items-center justify-between p-3">
        <BackHome />
        <ThemeToggle className="grid size-11 cursor-pointer place-items-center rounded-input text-muted hover:bg-paper-3 hover:text-ink" />
      </div>
      <main className="flex flex-1 items-start justify-center px-4 pt-[3vh] pb-12 lg:pt-[5vh]">
        {owner ? (
          <div className="w-full max-w-md">
            <Title />
            {/* Backup owner login (email + password), not linked anywhere: the owner normally signs in with Clerk. */}
            <section aria-labelledby="owner-heading">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id="owner-heading" className="font-body text-xs font-medium text-muted">Atlas owner (backup login)</h2>
                <Link href="/login" className="rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-paper-3 hover:text-ink">Back</Link>
              </div>
              <OwnerForm />
            </section>
          </div>
        ) : (
          // Laptop: access (waitlist / sign in) on the left, the demo on the right. Phone: stacked.
          <div className="grid w-full max-w-6xl items-start gap-8 lg:grid-cols-[400px_1fr] lg:gap-10">
            <div className="lg:sticky lg:top-6">
              <Title />
              {CLERK_ON && (
                <MaybeClerk>
                  <Suspense>
                    <AccessPanel />
                  </Suspense>
                </MaybeClerk>
              )}
            </div>
            <Demo company={company} />
          </div>
        )}
      </main>
    </div>
  );
}

function Title() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <Link href="/" aria-label="Atlas home"><Logo className="size-8 text-accent" /></Link>
      <div>
        <h1 className="text-lg font-semibold">Log in to Atlas</h1>
        <p className="text-sm text-muted">Answers from your company&apos;s documents, with the source</p>
      </div>
    </div>
  );
}

const GROUPS: { title: string; roles: Role[] }[] = [
  { title: "Admin · sees everything in the company", roles: ["Admin"] },
  { title: "Managers · their own departments", roles: ["Manager"] },
  { title: "Members and guests · the least access", roles: ["Member", "Guest"] },
];

function Demo({ company }: { company: DemoCompany }) {
  const tint = { "--co": company.color } as React.CSSProperties;
  return (
    <section aria-labelledby="demo-heading">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" />
        <h2 id="demo-heading" className="font-body text-xs font-medium text-muted">Or try the demo · no sign-up</h2>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Step n={1} /> Choose a company
      </p>
      {/* Folder tabs: the chosen company's tab joins the panel below it, so the people clearly belong to it. */}
      <nav aria-label="Demo companies" className="relative z-10 grid grid-cols-3 gap-2 px-2 sm:gap-3 sm:px-3">
        {DEMO_COMPANIES.map((c) => {
          const on = c.slug === company.slug;
          return (
            <Link
              key={c.slug}
              href={`/login?company=${c.slug}`}
              scroll={false}
              aria-current={on ? "page" : undefined}
              style={{ "--co": c.color } as React.CSSProperties}
              className={
                on
                  ? "-mb-px flex flex-col items-center gap-1.5 rounded-t-card border-x-2 border-t-2 border-(--co) bg-paper px-2 pt-2.5 pb-3 text-center sm:flex-row sm:gap-3 sm:px-3 sm:text-left"
                  : "mb-1.5 flex flex-col items-center gap-1.5 rounded-card border border-rule bg-paper-2 px-2 py-2 text-center opacity-80 hover:bg-paper hover:opacity-100 sm:flex-row sm:gap-3 sm:px-3 sm:text-left"
              }
            >
              <CompanyLogo slug={c.slug} color={c.color} second={c.accent} className="size-9 shrink-0" />
              <span className="w-full min-w-0">
                <span className="block text-xs leading-tight font-medium sm:truncate sm:text-sm">{c.name}</span>
                <span className="hidden truncate text-xs text-muted sm:block">{on ? "Selected" : c.industry}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div style={tint} className="rounded-card border-2 border-(--co) bg-paper p-3 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start gap-3 border-b border-rule pb-4">
          <CompanyLogo slug={company.slug} color={company.color} second={company.accent} className="size-11 shrink-0" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <Step n={2} /> Log in as someone at {company.name}
            </p>
            <p className="mt-1 text-xs text-muted">{company.industry} · {company.description}</p>
          </div>
        </div>

        <form action={loginAs} className="space-y-4">
          {GROUPS.map((g) => {
            const people = company.people.filter((p) => g.roles.includes(p.role));
            if (!people.length) return null;
            return (
              <div key={g.title}>
                <h3 className="mb-1.5 font-body text-[11px] font-medium tracking-wide text-muted uppercase">{g.title}</h3>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {people.map((p) => (
                    <li key={p.email}>
                      <button
                        type="submit"
                        name="email"
                        value={p.email}
                        data-track="demo_login"
                        data-track-props={JSON.stringify({ company: company.slug, role: p.role })}
                        className="h-full w-full cursor-pointer rounded-input border border-rule bg-paper-2 px-3 py-2.5 text-left transition-colors hover:border-(--co) hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{p.name}</span>
                          <span className="shrink-0 rounded-pill bg-accent-soft px-2 text-[11px] leading-5 font-medium text-accent-deep">{p.role}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">{p.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted">{p.departments.join(", ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </form>
      </div>
      <p className="mt-3 text-xs text-muted">Tip: ask the same question as two people and compare the answers.</p>
    </section>
  );
}

const Step = ({ n }: { n: number }) => (
  <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-paper">{n}</span>
);
