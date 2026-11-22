import { Empty } from "@/components/empty";
import { firstName } from "@/lib/demo-users";
import { getUser } from "@/lib/session";

export default async function HomePage() {
  const user = await getUser();
  if (!user) return null; // the layout already redirects
  const { person, company } = user;

  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-[var(--gutter)] py-16">
      <header className="grid gap-2">
        <p className="text-sm text-muted">{company.name}</p>
        <h1 className="text-3xl font-semibold">Hello, {firstName(person.name)}</h1>
        <p className="flex flex-wrap items-center gap-2 text-muted">
          <span className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-sm font-medium text-accent-deep">{person.role}</span>
          {person.title} · {person.departments.join(", ")}
        </p>
      </header>
      <Empty title="Ask and Library open in the next phases" body="This is your own dashboard. Questions, documents and suggested questions for your role arrive here soon." />
    </div>
  );
}
