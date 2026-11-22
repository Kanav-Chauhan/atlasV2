import { notFound } from "next/navigation";
import { Empty } from "@/components/empty";
import { navFor } from "@/lib/nav";
import { getUser } from "@/lib/session";

export default async function PlaceholderPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const user = await getUser();
  // Only pages in this person's rail exist for them.
  const item = user && navFor(user.person.role).find((i) => i.slug && i.slug === page);
  if (!item) notFound();

  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-[var(--gutter)] py-16">
      <h1 className="text-3xl font-semibold">{item.label}</h1>
      <Empty title="Coming in a later phase" body={`${item.label} is planned in PLAN.md and will open here once it is built.`} />
    </div>
  );
}
