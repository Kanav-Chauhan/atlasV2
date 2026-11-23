import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { logout } from "@/app/actions";
import { MaybeClerk } from "@/components/clerk-provider";
import { ClerkLogout } from "@/components/clerk-logout";
import { CompanyLogo, HAS_LOGO } from "@/components/company-logo";
import { Icon } from "@/components/ui/icons";
import { RailDests } from "@/components/rail";
import { ThemeToggle } from "@/components/theme-toggle";
import { DEMO_COMPANIES, initials } from "@/lib/demo-users";
import { CLERK_ON } from "@/lib/clerk";
import { navGroupsFor } from "@/lib/nav";
import { getUser } from "@/lib/session";
import "./controls.css";
import "./dash.css";
import "./shell.css";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) {
    // Signed in with Clerk but no Atlas person yet → create a company (or wait for an invite).
    if (CLERK_ON && (await auth()).userId) redirect("/onboarding");
    redirect("/login");
  }
  const { person, company } = user;
  const clerkUser = user.auth === "clerk";

  const brand = DEMO_COMPANIES.find((c) => c.slug === company.slug);

  const shell = (
    <div className="app">
      <nav className="rail" aria-label="Main">
        <Link className="rail-logo" href="/app" aria-label={`${company.name}, Atlas home`}>
          {brand && HAS_LOGO(brand.slug) ? (
            <CompanyLogo slug={brand.slug} color={brand.color} second={brand.accent} className="rail-mark" />
          ) : (
            <span className="rail-mark rail-mono" aria-hidden="true">{company.name.slice(0, 1)}</span>
          )}
          <span className="rail-co">
            <strong>{company.name}</strong>
            <small>Atlas</small>
          </span>
        </Link>
        <RailDests groups={navGroupsFor(person.role)} />
        <div className="rail-foot">
          <div className="rail-me" title={`${person.name}, ${person.role}, ${company.name}`}>
            <span className="avatar" aria-hidden="true">{initials(person.name)}</span>
            <span className="rail-me-text">
              <strong>{person.name}</strong>
              <small>{person.role}</small>
            </span>
          </div>
          <div className="rail-tools">
            <ThemeToggle className="rail-btn" />
            {clerkUser ? (
              <ClerkLogout className="rail-btn rail-out" />
            ) : (
              <form action={logout}>
                <button type="submit" className="rail-btn rail-out"><Icon name="logout" className="size-[18px]" />Log out</button>
              </form>
            )}
          </div>
        </div>
      </nav>
      <main className="min-w-0">{children}</main>
    </div>
  );
  // Clerk's script only loads for real users (keeps their session fresh); demo visitors skip it.
  return clerkUser ? <MaybeClerk>{shell}</MaybeClerk> : shell;
}
