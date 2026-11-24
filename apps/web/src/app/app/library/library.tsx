"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DocViewer } from "@/components/doc-viewer/doc-viewer";
import { useDocViewer, useViewerSize } from "@/components/doc-viewer/use-doc-viewer";
import { Icon } from "@/components/ui/icons";
import { Page, PageHeader } from "@/components/ui/page";
import { api } from "@/lib/api";
import { FILTER_KEYS, type LibraryDoc, type LibraryPage, libraryQuery, SORTS, STATUSES, TYPES } from "./params";
import { ManageDialog, type ManageTarget, RowActions } from "./manage";
import { DropZone, UploadDialog } from "./upload";

// UI Phase 4: the Library like the old Atlas — 20 documents a page with server-side search,
// filters and sort; a click opens the shared side viewer (?doc=); upload by drag and drop.

type Props = {
  company: string;
  initial: LibraryPage | null;
  initialQuery: string;
  isAdmin: boolean;
  /** Admin or manager: may upload (managers into their own departments) and sees "Needs review". */
  lead: boolean;
  ownDepartments: string[];
};

const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const nf = new Intl.NumberFormat("en-IN");
const plural = (n: number, one: string, many = `${one}s`) => `${nf.format(n)} ${n === 1 ? one : many}`;

export function Library({ company, initial, initialQuery, isAdmin, lead, ownDepartments }: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const viewer = useDocViewer();
  const [size, setSize] = useViewerSize();
  const [uploadOpen, setUploadOpen] = useState(params.get("upload") === "1");
  const [dropped, setDropped] = useState<File[]>([]);
  const [manage, setManage] = useState<ManageTarget | null>(null);
  const listTop = useRef<HTMLDivElement>(null);
  const canUpload = isAdmin || (lead && ownDepartments.length > 0);

  const query = libraryQuery(params);
  const { data, error, isPending, isFetching, refetch, isRefetching } = useQuery({
    queryKey: ["library", query],
    queryFn: () => api<LibraryPage>(`/documents/library?${query}`),
    initialData: query === initialQuery && initial ? initial : undefined,
    placeholderData: keepPreviousData,
    // Poll every 5 s while anything is still being read, so Processing turns into Ready by itself.
    refetchInterval: (q) => (q.state.data && q.state.data.counts.processing > 0 ? 5000 : false),
  });

  /** Change URL params (null removes); any filter change goes back to page 1. Reads the live URL so
   * the viewer's ?doc= (written with history.replaceState) is kept. */
  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("p" in patch)) next.delete("p");
    next.delete("access"); // old key, now "dept"
    router.replace(next.size ? `${path}?${next}` : path, { scroll: false });
  };
  const goPage = (p: number) => {
    setParams({ p: p > 1 ? String(p) : null });
    const top = listTop.current;
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: "start" });
  };

  // A stale link past the last page (?p=9 after documents were removed or filters narrowed): go to the last page.
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1;
  useEffect(() => {
    if (data && !isFetching && data.items.length === 0 && data.total > 0 && data.page > lastPage) {
      setParams({ p: lastPage > 1 ? String(lastPage) : null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setParams reads the live URL; re-run only on new data
  }, [data, isFetching, lastPage]);

  const openUpload = (files: File[] = []) => {
    setDropped(files);
    setUploadOpen(true);
  };
  const closeUpload = () => {
    setUploadOpen(false);
    setDropped([]);
    if (new URLSearchParams(window.location.search).has("upload")) setParams({ upload: null, p: params.get("p") });
  };

  // Where this person may upload: admin anywhere (incl. Everyone), managers only their own departments.
  const uploadTo = isAdmin ? (data?.departments ?? ["Everyone"]) : ownDepartments;
  const filtered = FILTER_KEYS.some((k) => params.get(k)) || !!params.get("access");
  const dept = params.get("dept") ?? params.get("access") ?? "";

  return (
    <Page className="lib">
      <PageHeader title="Library"
        description={lead ? "Every document Atlas answers from. Open one to read it or see how Atlas reads it." : "The documents you can read. Atlas answers only from these."}
        actions={canUpload && (
          <button type="button" className="btn btn-primary" onClick={() => openUpload()}>
            <Icon name="upload" className="size-4" />Upload documents
          </button>
        )} />

      {error && !data ? (
        <section className="state" role="alert">
          <h2 className="font-body text-md font-semibold">The document list didn&apos;t load</h2>
          <p className="text-sm text-muted">{error.message}</p>
          <button type="button" className="btn" onClick={() => refetch()} disabled={isRefetching}>{isRefetching ? "Retrying" : "Retry"}</button>
        </section>
      ) : isPending ? (
        <Skeleton />
      ) : data.all === 0 ? (
        canUpload ? (
          <DropZone big onFiles={openUpload}
            title="Add your company's first documents"
            body="Drop PDFs, Word, Markdown or text files here. Atlas reads them, and then everyone you allow can ask questions about them." />
        ) : (
          <section className="state lib-empty">
            <Icon name="library" className="size-8 text-muted" />
            <h2 className="font-body text-md font-semibold">No documents in your departments yet</h2>
            <p className="text-sm text-muted">When an admin or your manager adds one, it shows up here.</p>
          </section>
        )
      ) : (
        <>
          <Summary data={data} status={params.get("status") ?? ""} onStatus={(s) => setParams({ status: s })} />
          <Toolbar params={params} departments={data.departments} lead={lead} filtered={filtered} dept={dept} onChange={setParams}
            onClear={() => setParams(Object.fromEntries([...FILTER_KEYS, "access"].map((k) => [k, null])))} />

          <div ref={listTop} className="lib-results" aria-busy={isFetching || undefined}>
            <h2 className="sr-only">Documents</h2>
            {data.total === 0 ? (
              <section className="state lib-empty">
                <Icon name="search" className="size-8 text-muted" />
                <h3 className="font-body text-md font-semibold">No documents match</h3>
                <p className="text-sm text-muted">Try other words, or clear the filters to see all {plural(data.all, "document")}.</p>
                <button type="button" className="btn" onClick={() => setParams(Object.fromEntries([...FILTER_KEYS, "access"].map((k) => [k, null])))}>Clear filters</button>
              </section>
            ) : (
              <>
                <DocTable docs={data.items} onOpen={(id) => viewer.open({ doc: String(id) })} onManage={setManage} />
                <DocCards docs={data.items} onOpen={(id) => viewer.open({ doc: String(id) })} onManage={setManage} />
                <Pager page={data.page} perPage={data.per_page} total={data.total} onPage={goPage} />
              </>
            )}
          </div>
        </>
      )}

      {/* Everyone who sees the Library may see how Atlas reads a document (Guests have no Library). */}
      {viewer.current && (
        <DocViewer mode="overlay" current={viewer.current} onUpdate={viewer.update} onClose={viewer.close}
          size={size} onSize={setSize} canSeeChunks company={company} />
      )}
      {manage && (
        <ManageDialog key={`${manage.action}-${manage.doc.id}`} target={manage} onClose={() => setManage(null)}
          onDeleted={(id) => { if (viewer.current?.doc === String(id)) viewer.close(); }} />
      )}
      {canUpload && (
        <UploadDialog open={uploadOpen} onClose={closeUpload} files={dropped} isAdmin={isAdmin} uploadTo={uploadTo}
          preferred={uploadTo.includes(dept) ? dept : ""} />
      )}
    </Page>
  );
}

/** "68 documents · 2 processing · 1 failed": the old Atlas's per-collection counts, as filters. */
function Summary({ data, status, onStatus }: { data: LibraryPage; status: string; onStatus: (s: string | null) => void }) {
  const { processing, failed } = data.counts;
  return (
    <p className="lib-summary" aria-live="polite">
      <span>{plural(data.all, "document")}</span>
      {processing > 0 && (
        <button type="button" className="lib-sum-btn" data-tone="info" aria-pressed={status === "processing"}
          onClick={() => onStatus(status === "processing" ? null : "processing")}>
          <span className="dot lib-pulse" aria-hidden="true" />{nf.format(processing)} processing
        </button>
      )}
      {failed > 0 && (
        <button type="button" className="lib-sum-btn" data-tone="error" aria-pressed={status === "failed"}
          onClick={() => onStatus(status === "failed" ? null : "failed")}>
          <span className="dot" aria-hidden="true" />{nf.format(failed)} failed
        </button>
      )}
    </p>
  );
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Toolbar({ params, departments, lead, filtered, dept, onChange, onClear }: {
  params: URLSearchParams; departments: string[]; lead: boolean; filtered: boolean; dept: string;
  onChange: (patch: Record<string, string | null>) => void; onClear: () => void;
}) {
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const debounced = useDebounced(q);
  const last = useRef(urlQ);
  // Typing → URL (debounced); URL → box when it changes from outside (Clear filters, back button).
  useEffect(() => {
    if (debounced.trim() !== last.current.trim()) {
      last.current = debounced;
      onChange({ q: debounced.trim() || null });
    }
  }, [debounced, onChange]);
  useEffect(() => {
    if (urlQ.trim() !== last.current.trim()) {
      last.current = urlQ;
      setQ(urlQ);
    }
  }, [urlQ]);

  const status = params.get("status") ?? "";
  const statuses = Object.entries(STATUSES).filter(([k]) => lead || k !== "review");
  const isPublic = params.get("public") === "1";

  return (
    <div className="lib-toolbar" role="search" aria-label="Find documents">
      <div className="lib-search">
        <Icon name="search" className="size-4" />
        <label className="sr-only" htmlFor="lib-q">Search by title or document code</label>
        <input id="lib-q" type="search" className="field" placeholder="Search by title or code" value={q} maxLength={200}
          onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="lib-filters">
        <Select id="lib-dept" label="Department" value={dept} onChange={(v) => onChange({ dept: v, access: null })}
          options={[["", "All departments"], ...departments.map((d) => [d, d] as [string, string])]} />
        <Select id="lib-type" label="Type" value={params.get("type") ?? ""} onChange={(v) => onChange({ type: v })}
          options={[["", "All types"], ...Object.entries(TYPES)]} />
        <Select id="lib-status" label="Status" value={status} onChange={(v) => onChange({ status: v })}
          options={[["", "Any status"], ...statuses]} />
        <button type="button" className="chip lib-public" aria-pressed={isPublic} onClick={() => onChange({ public: isPublic ? null : "1" })}>
          <Icon name="website" className="size-4" />Public on website
        </button>
      </div>
      <div className="lib-sort">
        {filtered && <button type="button" className="btn btn-quiet" onClick={onClear}>Clear filters</button>}
        <Select id="lib-sort" label="Sort" value={params.get("sort") === "title" ? "title" : "updated"}
          onChange={(v) => onChange({ sort: v === "title" ? "title" : null })} options={Object.entries(SORTS)} />
      </div>
    </div>
  );
}

function Select({ id, label, value, options, onChange }: {
  id: string; label: string; value: string; options: [string, string][]; onChange: (v: string) => void;
}) {
  return (
    <span className="lib-select">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} data-active={value ? "" : undefined}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </span>
  );
}

// ------------------------------------------------------------------ rows

const TYPE_SHORT: Record<string, string> = { pdf: "PDF", docx: "DOC", md: "MD", txt: "TXT" };

function TypeIcon({ format }: { format: string }) {
  return <span className="ftype" data-format={format} aria-hidden="true">{TYPE_SHORT[format] ?? format.toUpperCase()}</span>;
}

/** Same department, same colour everywhere (8 soft document colours); Everyone stays neutral. */
function deptTone(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `var(--color-doc-${(h % 8) + 1})`;
}

function DeptBadge({ name }: { name: string }) {
  return (
    <span className="badge dept" style={name === "Everyone" ? undefined : { background: deptTone(name) }}>
      {name === "Everyone" ? "Everyone" : name}
    </span>
  );
}

function Badges({ d }: { d: LibraryDoc }) {
  const busy = d.status === "queued" || d.status === "processing";
  return (
    <span className="lib-badges">
      {d.status === "ready" && <span className="badge" data-tone="success"><Icon name="check" />Ready</span>}
      {busy && <span className="badge" data-tone="info"><span className="dot lib-pulse" aria-hidden="true" />Processing</span>}
      {d.status === "failed" && <span className="badge" data-tone="error"><Icon name="alert" />Failed</span>}
      {d.review && (
        <span className="badge" data-tone="warn" title={d.review}><Icon name="clock" />Needs review<span className="sr-only">: {d.review}</span></span>
      )}
      {d.is_public && <span className="badge" data-tone="accent" title="Visitors to your website can get answers from it"><Icon name="website" />Public</span>}
      {d.superseded_by && <span className="badge" title="A newer version replaces this document">Superseded</span>}
    </span>
  );
}

function Title({ d, onOpen }: { d: LibraryDoc; onOpen: (id: number) => void }) {
  const meta = [d.doc_no, d.pages ? plural(d.pages, "page") : null].filter(Boolean).join(" · ");
  return (
    <div className="lib-title">
      <TypeIcon format={d.format} />
      <div className="min-w-0">
        <button type="button" className="lib-open" aria-haspopup="dialog" onClick={() => onOpen(d.id)}>
          {d.title}<span className="sr-only">, {TYPES[d.format as keyof typeof TYPES] ?? d.format}</span>
        </button>
        {meta && <p className="lib-meta">{meta}</p>}
        {d.status === "failed" && <p className="lib-error">{d.error ?? "Atlas couldn't read this file."}</p>}
      </div>
    </div>
  );
}

type ListProps = { docs: LibraryDoc[]; onOpen: (id: number) => void; onManage: (t: ManageTarget) => void };

function DocTable({ docs, onOpen, onManage }: ListProps) {
  return (
    <div className="table-wrap lib-table">
      <table className="tbl">
        <thead>
          <tr><th scope="col">Document</th><th scope="col">Department</th><th scope="col">Status</th><th scope="col">Updated</th>{docs.some((d) => d.can_manage) && <th scope="col"><span className="sr-only">Actions</span></th>}</tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td><Title d={d} onOpen={onOpen} /></td>
              <td><DeptBadge name={d.access} /></td>
              <td><Badges d={d} /></td>
              <td className="lib-date"><time dateTime={d.updated_at}>{date.format(new Date(d.updated_at))}</time></td>
              {docs.some((x) => x.can_manage) && <td className="lib-actions-cell"><RowActions d={d} onManage={onManage} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Phone: one card per document instead of the table. */
function DocCards({ docs, onOpen, onManage }: ListProps) {
  return (
    <ul className="lib-cards">
      {docs.map((d) => (
        <li key={d.id} className="lib-card">
          <Title d={d} onOpen={onOpen} />
          <div className="lib-card-foot">
            <DeptBadge name={d.access} />
            <Badges d={d} />
            <time className="lib-date" dateTime={d.updated_at}>{date.format(new Date(d.updated_at))}</time>
            <RowActions d={d} onManage={onManage} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Pager({ page, perPage, total, onPage }: { page: number; perPage: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = Math.min(total, (page - 1) * perPage + 1);
  const to = Math.min(total, page * perPage);
  return (
    <nav className="lib-pager" aria-label="Document pages">
      <span className="text-sm text-muted" aria-live="polite">
        {from > total ? `Page ${page} is empty` : `${nf.format(from)}–${nf.format(to)} of ${nf.format(total)}`}
      </span>
      {pages > 1 || page > 1 ? (
        <span className="lib-pager-btns">
          <button type="button" className="btn" disabled={page <= 1} onClick={() => onPage(Math.min(page - 1, pages))}>Previous</button>
          <span className="text-sm">Page {nf.format(page)} of {nf.format(pages)}</span>
          <button type="button" className="btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
        </span>
      ) : null}
    </nav>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading documents">
      {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" />)}
    </div>
  );
}
