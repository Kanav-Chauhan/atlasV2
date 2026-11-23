import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Waitlist } from "@clerk/nextjs";
import { AuthFrame } from "@/components/auth-frame";
import { MaybeClerk } from "@/components/clerk-provider";
import { ClerkCardSkeleton } from "@/components/clerk-skeleton";
import { CLERK_ON } from "@/lib/clerk";

export const metadata: Metadata = { title: "Join the waitlist" };

// The one waitlist: Clerk's own component, on our site (Clerk's "Join waitlist" link points here
// through waitlistUrl). The owner approves people in the Owner area or the Clerk dashboard.
export default function WaitlistPage() {
  if (!CLERK_ON) notFound();
  return (
    <AuthFrame title="Join the Atlas waitlist" sub="Atlas is invite-only for now. We'll email you when your invite is ready.">
      <MaybeClerk>
        <ClerkCardSkeleton title="Join the waitlist" sub="Enter your email address and we’ll let you know when your spot is ready" fields={["Email address"]} button="Join the waitlist" footer="Already have access? Sign in" />
        <Waitlist signInUrl="/sign-in" afterJoinWaitlistUrl="/login" />
      </MaybeClerk>
    </AuthFrame>
  );
}
