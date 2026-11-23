import type { Metadata } from "next";
import Link from "next/link";
import { loginAs, startSignIn } from "@/app/actions";
import { Logo } from "@/components/logo";
import { CompanyLogo } from "@/components/company-logo";
import { BackHome } from "@/components/auth-frame";
import { ThemeToggle } from "@/components/theme-toggle";
import { OwnerForm } from "./owner-form";
import { CLERK_ON } from "@/lib/clerk";
import { DEMO_COMPANIES, type DemoCompany } from "@/lib/demo-users";

export const metadata: Metadata = { title: "Log in" };

// Demo login: pick a company, then a person (one click). Step lives in ?company= so no client state is needed.
// Real users: "Sign in" → Clerk (/sign-in, Google or email) when CLERK_ON.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ company?: string; owner?: string }> }) {
  const { company: slug, owner } = await searchParams;
  const company = DEMO_COMPANIES.find((c) => c.slug === slug);

  return (
    <div className="flex min-h-dvh flex-col bg-paper-2">
      <div className="flex items-center justify-between p-3">
        <BackHome />
        <ThemeToggle className="grid size-11 cursor-pointer place-items-center rounded-input text-muted hover:bg-paper-3 hover:text-ink" />
      </div>
      <main className="flex flex-1 items-start justify-center px-4 pt-[6vh] pb-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3">
            <Link href="/" aria-label="Atlas home"><Logo className="size-8 text-accent" /></Link>
            <div>
              <h1 className="text-lg font-semibold">Log in to Atlas</h1>
              <p className="text-sm text-muted">Try the demo as someone at a fictional company</p>
            </div>
          </div>
          {owner ? (
            <section aria-labelledby="owner-heading">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id="owner-heading" className="font-body text-xs font-medium text-muted">Atlas owner</h2>
                <Link href="/login" className="rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-paper-3 hover:text-ink">Back to demo</Link>
              </div>
              <OwnerForm />
              <p className="mt-2 text-xs text-muted">For the person who runs Atlas: every company, evaluations and usage.</p>
            </section>
          ) : (
            <section aria-labelledby="demo-heading">{company ? <PersonPicker company={company} /> : <CompanyPicker />}</section>
          )}
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
  return <CompanyLogo slug={company.slug} color={company.color} second={company.accent} className={`shrink-0 ${small ? "size-7" : "size-9"}`} />;
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
      {CLERK_ON && (
        <form action={startSignIn} className="mt-6">
          <button type="submit" data-track="sign_in_click" className="group flex w-full cursor-pointer items-center gap-3 rounded-card border border-rule bg-paper px-4 py-3 text-left hover:bg-paper-2">
            <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-accent text-xs font-semibold text-accent-ink">↪</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Sign in to your company</span>
              <span className="block text-xs text-muted">With Google or your work email</span>
            </span>
            <Arrow />
          </button>
        </form>
      )}
      <Link href="/login?owner=1" className={`group ${CLERK_ON ? "mt-2" : "mt-6"} flex items-center gap-3 rounded-card border border-rule bg-paper px-4 py-3 hover:bg-paper-2`}>
        <Logo className="size-7 shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Atlas owner</span>
          <span className="block text-xs text-muted">Log in with the owner email and password</span>
        </span>
        <Arrow />
      </Link>
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
                  data-track="demo_login"
                  data-track-props={JSON.stringify({ company: company.slug, role: p.role })}
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
