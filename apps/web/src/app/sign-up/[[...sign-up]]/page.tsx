import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
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
      <MaybeClerk>
        <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" fallbackRedirectUrl="/app" />
      </MaybeClerk>
    </AuthFrame>
  );
}
