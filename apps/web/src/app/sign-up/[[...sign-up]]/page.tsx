import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { MaybeClerk } from "@/components/clerk-provider";
import { CLERK_ON } from "@/lib/clerk";

export const metadata: Metadata = { title: "Create your account" };

// Invited people land here from their invitation email (Clerk adds the ticket to the URL), and
// waitlist people once the owner invites them. New companies continue to /onboarding.
export default function SignUpPage() {
  if (!CLERK_ON) notFound();
  return (
    <AuthFrame title="Create your Atlas account" sub="Use the email address your invitation went to">
      <div className="mb-4 rounded-card border border-rule bg-paper p-4">
        <p className="text-sm font-semibold">Atlas is invite-only for now</p>
        <p className="mt-1 text-sm text-muted">Signing in works once you&apos;ve been invited. New here?{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full load so Clerk mounts */}
          <a href="/waitlist" className="font-medium text-accent-deep underline underline-offset-2">Join the waitlist</a>, or <Link href="/login" className="font-medium text-accent-deep underline underline-offset-2">try the demo</Link> with no sign-up.</p>
      </div>
      <MaybeClerk>
        <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" fallbackRedirectUrl="/auth/owner" />
      </MaybeClerk>
    </AuthFrame>
  );
}
