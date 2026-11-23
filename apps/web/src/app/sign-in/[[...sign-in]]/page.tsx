import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { MaybeClerk } from "@/components/clerk-provider";
import { ClerkCardSkeleton } from "@/components/clerk-skeleton";
import { CLERK_ON } from "@/lib/clerk";

export const metadata: Metadata = { title: "Sign in" };

// Real users (Google or email). Sign-up is invite/waitlist only while Clerk is in Waitlist mode.
export default function SignInPage() {
  if (!CLERK_ON) notFound();
  return (
    <AuthFrame title="Sign in to Atlas" sub="Your own company's documents">
      <div className="mb-4 rounded-card border border-rule bg-paper p-4">
        <p className="text-sm font-semibold">Atlas is invite-only for now</p>
        <p className="mt-1 text-sm text-muted">Signing in works once you&apos;ve been invited. New here?{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full load so Clerk mounts */}
          <a href="/waitlist" className="font-medium text-accent-deep underline underline-offset-2">Join the waitlist</a>, or <Link href="/login" className="font-medium text-accent-deep underline underline-offset-2">try the demo</Link> with no sign-up.</p>
      </div>
      <MaybeClerk>
        <ClerkCardSkeleton title="Sign in to Atlas" sub="Welcome back! Please sign in to continue" fields={["Email address"]} button="Continue" footer="Want early access? Join waitlist" social />
        <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/auth/owner" />
      </MaybeClerk>
    </AuthFrame>
  );
}
