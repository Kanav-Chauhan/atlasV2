import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QueryProvider } from "@/components/query";
import { navFor } from "@/lib/nav";
import { getUser } from "@/lib/session";
import { Website } from "./website";
import "../ask/ask.css";
import "./website.css";

export const metadata: Metadata = { title: "Website chat" };

export default async function WebsitePage() {
  const user = await getUser();
  if (!user || !navFor(user.person.role).some((i) => i.slug === "website")) notFound();
  return (
    <QueryProvider>
      <Website />
    </QueryProvider>
  );
}
