import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QueryProvider } from "@/components/query";
import { navFor } from "@/lib/nav";
import { getUser } from "@/lib/session";
import { Agents } from "./agents";
import "./agents.css";

export const metadata: Metadata = { title: "Agent access" };

export default async function AgentsPage() {
  const user = await getUser();
  if (!user || !navFor(user.person.role).some((i) => i.slug === "agents")) notFound();
  return (
    <QueryProvider>
      <Agents />
    </QueryProvider>
  );
}
