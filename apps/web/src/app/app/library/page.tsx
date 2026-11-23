import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { QueryProvider } from "@/components/query";
import { navFor } from "@/lib/nav";
import { getUser } from "@/lib/session";
import { Library } from "./library";
import { type LibraryPage, libraryQuery } from "./params";
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

export default async function LibraryRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getUser();
  if (!user || !navFor(user.person.role).some((i) => i.slug === "library")) notFound();
  const { role, departments } = user.person;
  const isAdmin = role === "Admin";
  const lead = isAdmin || role === "Manager";

  // The first page for the filters in the URL, so a shared link paints with its rows.
  const flat = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") flat.set(k, v);
  const query = libraryQuery(flat);
  const initial = await get<LibraryPage>(`/documents/library?${query}`);

  return (
    <QueryProvider>
      <Library company={user.company.name} initial={initial} initialQuery={query} isAdmin={isAdmin} lead={lead}
        ownDepartments={departments} />
    </QueryProvider>
  );
}
