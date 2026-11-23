import type { Metadata } from "next";
import Link from "next/link";
import { loginAs, startSignIn } from "@/app/actions";
import { Logo } from "@/components/logo";
import { CompanyLogo } from "@/components/company-logo";
import { BackHome } from "@/components/auth-frame";
import { ThemeToggle } from "@/components/theme-toggle";
import { OwnerForm } from "./owner-form";
import { CLERK_ON } from "@/lib/clerk";
import { DEMO_COMPANIES, type DemoCompany, type Role } from "@/lib/demo-users";

export const metadata: Metadata = { title: "Log in" };

// Real users (and the Atlas owner): the big "Sign in" button → Clerk (/sign-in, Google or email).
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
      <main className="flex flex-1 items-start justify-center px-4 pt-[3vh] pb-12">
        <div className={`w-full ${owner ? "max-w-md" : "max-w-3xl"}`}>
          <div className="mb-6 flex items-center gap-3">
            <Link href="/" aria-label="Atlas home"><Logo className="size-8 text-accent" /></Link>
            <div>
              <h1 className="text-lg font-semibold">Log in to Atlas</h1>
              <p className="text-sm text-muted">Sign in to your company, or try the demo as someone at a fictional one</p>
            </div>
          </div>
          {owner ? (
            // Backup owner login (email + password), not linked anywhere: the owner normally signs in with Clerk.
            <section aria-labelledby="owner-heading">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id="owner-heading" className="font-body text-xs font-medium text-muted">Atlas owner (backup login)</h2>
                <Link href="/login" className="rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-paper-3 hover:text-ink">Back</Link>
              </div>
              <OwnerForm />
            </section>
          ) : (
            <>
              {CLERK_ON && <SignInButton />}
              <Demo company={company} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function SignInButton() {
  return (
    <form action={startSignIn} className="mb-8">
      <button
        type="submit"
        data-track="sign_in_click"
        className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-card bg-accent px-5 py-3 text-accent-ink shadow-sm transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <GoogleMark />
        <span className="text-left">
          <span className="block text-sm font-semibold">Sign in with Google or email</span>
          <span className="block text-xs opacity-85">Your company&apos;s workspace, or the Atlas owner area</span>
        </span>
      </button>
    </form>
  );
}

const GoogleMark = () => (
  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-white">
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  </span>
);

const GROUPS: { title: string; roles: Role[] }[] = [
  { title: "Admin · sees everything in the company", roles: ["Admin"] },
  { title: "Managers · their own departments", roles: ["Manager"] },
  { title: "Members and guests · the least access", roles: ["Member", "Guest"] },
];

function Demo({ company }: { company: DemoCompany }) {
  return (
    <section aria-labelledby="demo-heading">
      <div className="mb-3 flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" />
        <h2 id="demo-heading" className="font-body text-xs font-medium text-muted">Or try the demo · no sign-up</h2>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <nav aria-label="Demo companies" className="mb-4 grid grid-cols-3 gap-2">
        {DEMO_COMPANIES.map((c) => {
          const on = c.slug === company.slug;
          return (
            <Link
              key={c.slug}
              href={`/login?company=${c.slug}`}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={`flex flex-col items-center gap-1.5 rounded-card border px-2 py-2.5 text-center sm:flex-row sm:gap-3 sm:px-3 sm:text-left ${on ? "border-accent bg-paper ring-1 ring-accent" : "border-rule bg-paper/60 hover:bg-paper"}`}
            >
              <CompanyLogo slug={c.slug} color={c.color} second={c.accent} className="size-9 shrink-0" />
              <span className="w-full min-w-0">
                <span className="block text-xs leading-tight font-medium sm:truncate sm:text-sm">{c.name}</span>
                <span className="hidden truncate text-xs text-muted sm:block">{c.industry}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <p className="mb-4 text-xs text-muted">{company.description} Pick a person to log in as them.</p>

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
                      className="h-full w-full cursor-pointer rounded-card border border-rule bg-paper px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
      <p className="mt-4 text-xs text-muted">Ask the same question as two people and compare the answers.</p>
    </section>
  );
}
