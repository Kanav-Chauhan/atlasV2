import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { superLogout } from "@/app/actions";
import { Logo } from "@/components/logo";
import { CLERK_ON } from "@/lib/clerk";
import { QueryProvider } from "@/components/query";
import { ThemeToggle } from "@/components/theme-toggle";
import "../app/controls.css";
import "../app/dash.css";
import "./super.css";

export const metadata: Metadata = { title: "Atlas owner" };

// The API checks the signature on every call; here we only send visitors without the cookie to /login.
export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  if (!(await cookies()).get("atlas_super")) redirect(CLERK_ON ? "/auth/owner" : "/login?owner=1");

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="super-bar">
        <Link href="/super" className="super-brand"><Logo className="size-6 text-accent" />Atlas owner</Link>
        <nav aria-label="Owner" className="super-nav">
          <Link href="/super#companies">Companies</Link>
          <Link href="/super#evals">Evaluations</Link>
          <Link href="/super#usage">Usage</Link>
          <Link href="/super#waitlist">Waitlist</Link>
          <Link href="/app/lab">Retrieval lab</Link>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle className="icon-btn" />
          <form action={superLogout}><button type="submit" className="btn">Log out</button></form>
        </div>
      </header>
      <main className="super-main">
        <QueryProvider>{children}</QueryProvider>
      </main>
    </div>
  );
}
