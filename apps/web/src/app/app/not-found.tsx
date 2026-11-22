import Link from "next/link";

// Shown inside the app shell when a page doesn't exist or the person's role can't open it (pages call notFound()).
export default function AppNotFound() {
  return (
    <div className="mx-auto grid max-w-xl gap-3 px-[var(--gutter)] py-16">
      <h1 className="text-2xl font-semibold">This page isn&apos;t available to you</h1>
      <p className="text-muted">It doesn&apos;t exist, or your role can&apos;t open it. Admins and managers see Team and Insights; only admins see Settings.</p>
      <Link className="btn btn-primary justify-self-start" href="/app">Go to Home</Link>
    </div>
  );
}
