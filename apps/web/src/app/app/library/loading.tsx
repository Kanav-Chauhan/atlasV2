import { Page, PageHeader } from "@/components/ui/page";
import "./library.css";

// Shown while the server fetches the first page of documents.
export default function Loading() {
  return (
    <Page className="lib">
      <PageHeader title="Library" description="Loading documents…" />
      <div className="grid gap-3" aria-busy="true" aria-label="Loading documents">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" />)}
      </div>
    </Page>
  );
}
