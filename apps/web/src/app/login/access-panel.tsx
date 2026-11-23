"use client";

import { SignIn, Waitlist } from "@clerk/nextjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClerkCardSkeleton } from "@/components/clerk-skeleton";

type Tab = "waitlist" | "signin";
const TABS: { id: Tab; label: string }[] = [
  { id: "waitlist", label: "Join waitlist" },
  { id: "signin", label: "Sign in" },
];

// Waitlist and sign-in, both on /login. The tab lives in ?tab= so Clerk's own links
// ("Already have access? Sign in", "Join waitlist" → ClerkProvider signInUrl / waitlistUrl)
// switch it without leaving the page. Sign-in uses hash routing, so its later steps
// (code, password, Google return) stay on /login too.
export function AccessPanel() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const tab: Tab = params.get("tab") === "signin" ? "signin" : "waitlist";
  // Clerk sends people here after they join (afterJoinWaitlistUrl): show our own confirmation.
  const joined = params.get("joined") === "1";

  function select(next: Tab) {
    const q = new URLSearchParams(params);
    q.set("tab", next);
    q.delete("joined");
    router.replace(`${path}?${q}`, { scroll: false });
  }

  return (
    <section aria-label="Your own company" className="mb-2">
      <div role="tablist" aria-label="Access" className="mb-3 grid grid-cols-2 gap-1 rounded-input border border-rule bg-paper-3/60 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => select(t.id)}
            data-track={t.id === "signin" ? "sign_in_click" : "waitlist_click"}
            className={`min-h-10 cursor-pointer rounded-[6px] text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              tab === t.id ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-muted">
        {tab === "waitlist"
          ? "Atlas is invite-only for now. Join the waitlist and we'll email you an invite."
          : "For people who have been invited, and the Atlas owner."}
      </p>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "waitlist" && joined ? (
          <div role="status" className="rounded-card border border-[oklch(72%_0.13_150)] bg-[oklch(96%_0.04_150)] p-5 text-[oklch(32%_0.09_150)] dark:border-[oklch(45%_0.1_150)] dark:bg-[oklch(25%_0.05_150)] dark:text-[oklch(88%_0.08_150)]">
            <p className="flex items-center gap-2.5 text-base font-semibold">
              <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-[oklch(55%_0.15_150)] text-sm text-white">✓</span>
              You&apos;re on the waitlist
            </p>
            <p className="mt-2 text-sm">Thanks for joining. We&apos;ll email you an invite as soon as your spot is ready.</p>
            <p className="mt-3 text-sm">Meanwhile, try the full demo: pick a company and a person.</p>
          </div>
        ) : tab === "waitlist" ? (
          <>
            <ClerkCardSkeleton title="Join the waitlist" sub="Enter your email address and we’ll let you know when your spot is ready" fields={["Email address"]} button="Join the waitlist" footer="Already have access? Sign in" />
            <Waitlist signInUrl="/login?tab=signin" afterJoinWaitlistUrl="/login?tab=waitlist&joined=1" />
          </>
        ) : (
          <>
            <ClerkCardSkeleton title="Sign in to Atlas" sub="Welcome back! Please sign in to continue" fields={["Email address"]} button="Continue" footer="Want early access? Join waitlist" social />
            <SignIn routing="hash" signUpUrl="/sign-up" waitlistUrl="/login?tab=waitlist" fallbackRedirectUrl="/auth/owner" />
          </>
        )}
      </div>
    </section>
  );
}
