import type { Metadata } from "next";
import { QueryProvider } from "@/components/query";
import { getUser } from "@/lib/session";
import { Ask } from "./ask";
import "./ask.css";

export const metadata: Metadata = { title: "Ask" };

export default async function AskPage() {
  const user = await getUser();
  return (
    <QueryProvider>
      <Ask company={user?.company.name ?? ""} canSeeChunks={!!user && user.person.role !== "Guest"} />
    </QueryProvider>
  );
}
