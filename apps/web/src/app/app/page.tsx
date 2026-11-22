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
      <form action="/app/ask" className="flex gap-2">
        <label className="sr-only" htmlFor="home-q">Ask about any company document</label>
        <input id="home-q" name="q" required className="field min-w-0 flex-1" placeholder="Ask about any company document" autoComplete="off" />
        <button type="submit" className="btn btn-primary">Ask</button>
      </form>
    </div>
  );
}
