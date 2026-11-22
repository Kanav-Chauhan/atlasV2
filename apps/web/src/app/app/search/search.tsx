"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

type Result = {
  chunk_id: string; document_id: string; title: string; doc_no: string | null; access: string;
  page: number | null; section: string | null; text: string; score: number; superseded: boolean;
};
type SearchResponse = { q: string; took_ms: number; results: Result[] };

const STOP = new Set(["the", "and", "for", "are", "how", "what", "who", "when", "does", "with", "from", "that", "this", "can", "many", "much"]);

/** Wraps the query's words in <mark>. */
export function Highlight({ text, q }: { text: string; q: string }) {
  const words = q.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)?.filter((w) => !STOP.has(w)) ?? [];
  if (!words.length) return text;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

export function Search({ examples }: { examples: string[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const q = params.get("q")?.trim() ?? "";
  const go = (next: string) => router.push(next.trim() ? `${path}?q=${encodeURIComponent(next.trim())}` : path, { scroll: false });

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["search", q],
    queryFn: () => api<SearchResponse>("/search", { q, top_k: 10 }),
    enabled: !!q,
  });

  return (
    <div className="search mx-auto grid max-w-3xl gap-6 px-[var(--gutter)] py-10">
      <header className="grid gap-1">
        <h1 className="text-3xl font-semibold">Search</h1>
        <p className="text-muted">Passages from documents you can open, ranked. No AI answer.</p>
      </header>

      <form role="search" className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(new FormData(e.currentTarget).get("q") as string); }}>
        <label className="sr-only" htmlFor="search-q">Search your documents</label>
        <input id="search-q" key={q} name="q" type="search" className="field min-w-0 flex-1" defaultValue={q} placeholder="Words, a policy number or a question" autoFocus />
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      {!q ? (
        <section className="grid gap-2">
          <h2 className="font-body text-sm font-semibold text-muted">Try a search</h2>
          <div className="flex flex-wrap gap-2">
            {examples.map((e) => <button key={e} type="button" className="chip" onClick={() => go(e)}>{e}</button>)}
          </div>
        </section>
      ) : isFetching && !data ? (
        <div className="grid gap-3" aria-busy="true" aria-label="Searching">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton result-skeleton" />)}
        </div>
      ) : error ? (
        <section className="state" role="alert">
          <h2 className="font-body text-md font-semibold">The search didn&apos;t finish</h2>
          <p className="text-sm text-muted">{error.message}</p>
          <button type="button" className="btn" onClick={() => refetch()}>Retry</button>
        </section>
      ) : data && data.results.length === 0 ? (
        <section className="state">
          <h2 className="font-body text-md font-semibold">Nothing in your documents matches</h2>
          <p className="text-sm text-muted">Try other words, or a document number. Only documents you can open are searched.</p>
        </section>
      ) : data ? (
        <section className="grid gap-3" aria-busy={isFetching}>
          <p className="text-xs text-muted">{data.results.length} {data.results.length === 1 ? "passage" : "passages"} in {data.took_ms} ms</p>
          <ol className="results">
            {data.results.map((r) => (
              <li key={r.chunk_id} className="result">
                <div className="result-head">
                  <h2 className="font-body text-md font-semibold">{r.title}</h2>
                  {r.doc_no && <span className="text-sm text-muted">{r.doc_no}</span>}
                  {r.superseded && <span className="tag tag-warn text-xs">Superseded</span>}
                </div>
                <div className="result-meta">
                  <span>{r.access}</span>
                  {r.page != null && <span>Page {r.page}</span>}
                  {r.section && <span className="min-w-0">{r.section}</span>}
                </div>
                <p className="passage"><Highlight text={r.text} q={data.q} /></p>
                <a className="open" href={`/api/documents/${r.document_id}/file${r.page ? `#page=${r.page}` : ""}`} target="_blank" rel="noreferrer">
                  Open document<span className="sr-only">: {r.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
