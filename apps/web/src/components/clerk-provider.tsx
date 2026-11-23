import { ClerkProvider } from "@clerk/nextjs";
import { CLERK_ON } from "@/lib/clerk";

// Clerk is mounted only on pages that need it (login, sign-up, onboarding, /app), never on
// /embed, /demo-site or the landing page, so those stay free of Clerk scripts and cookies.
// Colours come from the Atlas tokens, so the Clerk card follows light/dark like the rest.
// A line a step stronger than --color-rule (which almost disappears on the dark card) and the focus ring.
const LINE = "color-mix(in oklch, var(--color-rule) 55%, var(--color-muted))";
const FOCUS = "0 0 0 1px var(--color-accent), 0 0 0 4px color-mix(in srgb, var(--color-accent) 28%, transparent)";

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
          // 40 px tall boxes and buttons (clerk-skeleton.tsx bars match), a border that shows in dark mode
          // too, and a clear focus ring.
          formFieldInput: {
            minHeight: "40px",
            boxShadow: `0 0 0 1px ${LINE}`, // Clerk zeroes border-width and draws edges with box-shadow
            "&:hover": { boxShadow: "0 0 0 1px var(--color-muted)" },
            "&:focus, &:focus-visible": { outline: "none", boxShadow: FOCUS },
          },
          socialButtonsBlockButton: {
            minHeight: "40px",
            boxShadow: `0 0 0 1px ${LINE}`, // Clerk zeroes border-width and draws edges with box-shadow
            "&:hover": { boxShadow: "0 0 0 1px var(--color-muted)" },
            "&:focus-visible": { outline: "none", boxShadow: FOCUS },
          },
          socialButtonsIconButton: {
            minHeight: "40px",
            boxShadow: `0 0 0 1px ${LINE}`,
            "&:focus-visible": { outline: "none", boxShadow: FOCUS },
          },
          formButtonPrimary: {
            minHeight: "40px",
            "&:focus-visible": { outline: "2px solid var(--color-focus)", outlineOffset: "2px" },
          },
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
