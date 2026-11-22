// Calm empty state used by pages that are not built yet.
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <section className="grid justify-items-start gap-2 rounded-card border border-dashed border-rule bg-paper-2 p-8">
      <h2 className="font-body text-md font-semibold">{title}</h2>
      <p className="max-w-[52ch] text-sm text-muted">{body}</p>
    </section>
  );
}
