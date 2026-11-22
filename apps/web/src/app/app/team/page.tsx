import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QueryProvider } from "@/components/query";
import { navFor } from "@/lib/nav";
import { getUser } from "@/lib/session";
import { Team } from "./team";

export const metadata: Metadata = { title: "Team & access" };

export default async function TeamPage() {
  const user = await getUser();
  if (!user || !navFor(user.person.role).some((i) => i.slug === "team")) notFound();
  const { role, email, departments } = user.person;

  return (
    <QueryProvider>
      <Team isAdmin={role === "Admin"} me={email} myDepts={departments} />
    </QueryProvider>
  );
}
