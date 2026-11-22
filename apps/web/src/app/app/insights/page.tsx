import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QueryProvider } from "@/components/query";
import { navFor } from "@/lib/nav";
import { getUser } from "@/lib/session";
import { InsightsView } from "./insights";

export const metadata: Metadata = { title: "Insights" };

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await getUser();
  if (!user || !navFor(user.person.role).some((i) => i.slug === "insights")) notFound();
  const asked = (await searchParams).days;
  const days = [7, 30, 90].find((d) => String(d) === asked) ?? 30;
  const scope = user.person.role === "Admin" ? "Across the whole company." : `For your departments: ${user.person.departments.join(", ")}.`;

  return (
    <QueryProvider>
      <InsightsView days={days} scope={scope} />
    </QueryProvider>
  );
}
