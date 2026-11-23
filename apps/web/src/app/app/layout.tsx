import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { logout } from "@/app/actions";
import { MaybeClerk } from "@/components/clerk-provider";
import { ClerkLogout } from "@/components/clerk-logout";
import { Logo } from "@/components/logo";
import { RailDests } from "@/components/rail";
import { ThemeToggle } from "@/components/theme-toggle";
import { initials } from "@/lib/demo-users";
import { CLERK_ON } from "@/lib/clerk";
import { navFor } from "@/lib/nav";
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

  const shell = (
    <div className="app">
      <nav className="rail" aria-label="Main">
        <Link className="rail-logo" href="/app" aria-label="Atlas home">
          <Logo />
        </Link>
        <RailDests items={navFor(person.role)} />
        <div className="rail-foot">
          <ThemeToggle className="rail-btn" />
          <span className="avatar" title={`${person.name}, ${person.role}, ${company.name}`}>
            {initials(person.name)}
          </span>
          {clerkUser ? (
            <ClerkLogout className="rail-btn" />
          ) : (
            <form action={logout}>
              <button type="submit" className="rail-btn">Log out</button>
            </form>
          )}
        </div>
      </nav>
      <main className="min-w-0">{children}</main>
    </div>
  );
  // Clerk's script only loads for real users (keeps their session fresh); demo visitors skip it.
  return clerkUser ? <MaybeClerk>{shell}</MaybeClerk> : shell;
}
