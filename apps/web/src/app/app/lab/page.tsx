import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { QueryProvider } from "@/components/query";
import { getUser } from "@/lib/session";
import { Lab } from "./lab";
import "./lab.css";

// Owner-only tool: linked from the Owner area (/super), not from any company rail. It needs the owner
// cookie (the API re-checks its signature on owner calls) and a company admin login (the lab API
// searches as people in that company).
export default async function LabPage() {
  const user = await getUser();
  const owner = (await cookies()).has("atlas_super");
  if (!user || !owner || user.person.role !== "Admin") notFound();
  const people = user.company.people.map(({ name, title, email }) => ({ name, title, email }));

  return (
    <QueryProvider>
      <Lab people={people} me={user.person.email} />
    </QueryProvider>
  );
}
