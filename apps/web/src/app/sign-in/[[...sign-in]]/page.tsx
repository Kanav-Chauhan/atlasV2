import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { WaitlistForm } from "@/components/waitlist-form";
import { MaybeClerk } from "@/components/clerk-provider";
import { CLERK_ON } from "@/lib/clerk";

export const metadata: Metadata = { title: "Sign in" };

// Real users (Google or email). Sign-up is invite/waitlist only while Clerk is in Waitlist mode.
export default function SignInPage() {
  if (!CLERK_ON) notFound();
  return (
    <AuthFrame title="Sign in to Atlas" sub="Your own company's documents">
      <div className="mb-4 rounded-card border border-rule bg-paper p-4">
        <p className="text-sm font-semibold">Atlas is invite-only for now</p>
        <p className="mt-1 text-sm text-muted">Signing in works once you&apos;ve been invited. New here? Join the waitlist, or <Link href="/login" className="font-medium text-accent-deep underline underline-offset-2">try the demo</Link> with no sign-up.</p>
      </div>
      <MaybeClerk>
        <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/auth/owner" />
      </MaybeClerk>
      <div className="mt-6 rounded-card border border-rule bg-paper p-4">
        <p className="mb-3 text-sm font-semibold">Not invited yet? Join the waitlist</p>
        <WaitlistForm source="sign_in" />
      </div>
    </AuthFrame>
  );
}
