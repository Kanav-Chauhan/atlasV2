"use client";

import type { UseQueryResult } from "@tanstack/react-query";

// One data region, four states: loading, error, empty, full.
export function Region<T>({ q, what, empty, isEmpty, rows = 3, children }: {
  q: UseQueryResult<T>; what: string; empty: React.ReactNode; isEmpty?: (d: T) => boolean; rows?: number; children: (d: T) => React.ReactNode;
}) {
  if (q.isPending) {
    return (
      <div className="grid gap-2" aria-busy="true" aria-label={`Loading ${what}`}>
        {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" />)}
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="state" role="alert">
        <p className="text-sm font-semibold">The {what} didn&apos;t load</p>
        <p className="text-sm text-muted">{q.error.message}</p>
        <button type="button" className="btn" onClick={() => q.refetch()} disabled={q.isRefetching}>{q.isRefetching ? "Retrying" : "Retry"}</button>
      </div>
    );
  }
  if (isEmpty ? isEmpty(q.data) : Array.isArray(q.data) && q.data.length === 0) return <div className="state">{empty}</div>;
  return <>{children(q.data)}</>;
}
