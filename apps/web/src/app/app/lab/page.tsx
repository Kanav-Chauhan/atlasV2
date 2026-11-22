import { notFound } from "next/navigation";
import { QueryProvider } from "@/components/query";
import { navFor } from "@/lib/nav";
import { getUser } from "@/lib/session";
import { Lab } from "./lab";
import "./lab.css";

export default async function LabPage() {
  const user = await getUser();
  if (!user || !navFor(user.person.role).some((i) => i.slug === "lab")) notFound();
  const people = user.company.people.map(({ name, title, email }) => ({ name, title, email }));

  return (
    <QueryProvider>
      <Lab people={people} me={user.person.email} />
    </QueryProvider>
  );
}
