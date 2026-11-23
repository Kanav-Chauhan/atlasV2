import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QueryProvider } from "@/components/query";
import { navFor } from "@/lib/nav";
import { getMe, getUser } from "@/lib/session";
import { Settings } from "./settings";
import "./settings.css";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getUser();
  if (!user || !navFor(user.person.role).some((i) => i.slug === "settings")) notFound();
  const me = await getMe();
  return (
    <QueryProvider>
      <Suspense>
        <Settings admin={user.person.role === "Admin"} demo={me?.plan === "demo"} />
      </Suspense>
    </QueryProvider>
  );
}
