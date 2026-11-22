import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions";
import { Logo } from "@/components/logo";
import { RailDests } from "@/components/rail";
import { ThemeToggle } from "@/components/theme-toggle";
import { initials } from "@/lib/demo-users";
import { navFor } from "@/lib/nav";
import { getUser } from "@/lib/session";
import "./controls.css";
import "./shell.css";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login"); // TODO(Phase 4/10): real session check
  const { person, company } = user;

  return (
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
          <form action={logout}>
            <button type="submit" className="rail-btn">Log out</button>
          </form>
        </div>
      </nav>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
