import { ClerkProvider } from "@clerk/nextjs";
import { CLERK_ON } from "@/lib/clerk";

// Clerk is mounted only on pages that need it (login, sign-up, onboarding, /app), never on
// /embed, /demo-site or the landing page, so those stay free of Clerk scripts and cookies.
// Colours come from the Atlas tokens, so the Clerk card follows light/dark like the rest.
export function MaybeClerk({ children }: { children: React.ReactNode }) {
  if (!CLERK_ON) return children;
  return (
    <ClerkProvider
      signInUrl="/login?tab=signin"
      signUpUrl="/sign-up"
      waitlistUrl="/login?tab=waitlist"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      afterSignOutUrl="/login"
      appearance={{
        variables: {
          colorPrimary: "var(--color-accent)",
          colorPrimaryForeground: "var(--color-accent-ink)",
          colorBackground: "var(--color-paper)",
          colorForeground: "var(--color-ink)",
          colorMutedForeground: "var(--color-muted)",
          colorInput: "var(--color-paper)",
          colorInputForeground: "var(--color-ink)",
          colorBorder: "var(--color-rule)",
          colorDanger: "var(--color-error)",
          colorNeutral: "var(--color-ink)",
          fontFamily: "var(--font-body)",
          borderRadius: "8px",
        },
        elements: {
          rootBox: "w-full",
          cardBox: "w-full max-w-none shadow-none border border-rule rounded-card",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
