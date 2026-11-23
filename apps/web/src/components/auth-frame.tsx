import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

// The login page's frame (logo, title, theme toggle) for sign-in, sign-up and onboarding.
export function AuthFrame({ title, sub, children, back = true }: { title: string; sub: string; children: React.ReactNode; back?: boolean }) {
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
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold">{title}</h1>
              <p className="text-sm text-muted">{sub}</p>
            </div>
            {back && <Link href="/login" className="rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-paper-3 hover:text-ink">← Demo</Link>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

// Top-left link back to the landing page (login, sign-in, sign-up, onboarding).
export function BackHome() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-input px-3 text-sm text-muted hover:bg-paper-3 hover:text-ink">
      <span aria-hidden="true">←</span> Atlas home
    </Link>
  );
}
