// Real sign-in (Clerk) is on when the image was built with a publishable key
// (NEXT_PUBLIC_ vars are inlined at build time). Off → demo logins + super admin only.
export const CLERK_ON = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
