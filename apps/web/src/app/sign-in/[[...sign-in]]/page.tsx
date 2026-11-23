import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { AuthFrame } from "@/components/auth-frame";
import { MaybeClerk } from "@/components/clerk-provider";
import { CLERK_ON } from "@/lib/clerk";

export const metadata: Metadata = { title: "Sign in" };

// Real users (Google or email). Sign-up is invite/waitlist only while Clerk is in Waitlist mode.
export default function SignInPage() {
  if (!CLERK_ON) notFound();
  return (
    <AuthFrame title="Sign in to Atlas" sub="Your own company's documents">
      <MaybeClerk>
        <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/auth/owner" />
      </MaybeClerk>
    </AuthFrame>
  );
}
