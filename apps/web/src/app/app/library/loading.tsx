import "./library.css";

// Shown while the server fetches the document list.
export default function Loading() {
  return (
    <div className="lib mx-auto grid max-w-6xl gap-6 px-[var(--gutter)] py-10" aria-busy="true" aria-label="Loading documents">
      <div className="grid gap-1">
        <h1 className="text-3xl font-semibold">Library</h1>
        <p className="text-muted">Documents you can open.</p>
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" />)}
      </div>
    </div>
  );
}
