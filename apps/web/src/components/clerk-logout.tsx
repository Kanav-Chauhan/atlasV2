"use client";

import { useClerk } from "@clerk/nextjs";

// Ends the Clerk session everywhere (not only this tab), then back to the login page.
export function ClerkLogout({ className }: { className?: string }) {
  const { signOut } = useClerk();
  return (
    <button type="button" className={className} onClick={() => signOut({ redirectUrl: "/login" })}>
      Log out
    </button>
  );
}
