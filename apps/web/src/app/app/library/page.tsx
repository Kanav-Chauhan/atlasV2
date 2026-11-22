import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { navFor } from "@/lib/nav";
import { getUser } from "@/lib/session";
import type { Review } from "@/lib/types";
import { Library, type Doc } from "./library";
import "./library.css";

const API = process.env.API_URL || "http://localhost:8000";

// Server-side GET against the API, forwarding the visitor's cookie. null when it fails.
async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { cookie: (await headers()).get("cookie") ?? "" }, cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export default async function LibraryPage() {
  const user = await getUser();
  if (!user || !navFor(user.person.role).some((i) => i.slug === "library")) notFound();
  const { role, departments } = user.person;
  const isAdmin = role === "Admin";
  const canUpload = isAdmin || role === "Manager";

  const [docs, depts, review] = await Promise.all([
    get<Doc[]>("/documents"),
    isAdmin ? get<{ name: string }[]>("/departments") : null,
    canUpload ? get<Review[]>("/documents/review") : null,
  ]);
  // Where this person may upload: admin anywhere (incl. Everyone), managers only their own departments.
  const uploadTo = isAdmin ? ["Everyone", ...(depts ?? []).map((d) => d.name)] : canUpload ? departments : [];

  return <Library initial={docs} canUpload={canUpload} isAdmin={isAdmin} uploadTo={uploadTo} review={review ?? []} />;
}
