import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QueryProvider } from "@/components/query";
import { navFor } from "@/lib/nav";
import { getUser } from "@/lib/session";
import { Settings } from "./settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getUser();
  if (!user || !navFor(user.person.role).some((i) => i.slug === "settings")) notFound();
  return (
    <QueryProvider>
      <Settings />
    </QueryProvider>
  );
}
