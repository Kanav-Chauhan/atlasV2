"use client";

import { useEffect, useState } from "react";

export const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
export const dayOnly = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** The value, once it has stopped changing for `ms` (search boxes). */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** "21–40 of 45" with Previous / Next. Hidden when everything fits on one page. */
export function Pager({ page, perPage, total, onPage, what }: { page: number; perPage: number; total: number; onPage: (p: number) => void; what: string }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage && page === 1) return null;
  const from = Math.min(total, (page - 1) * perPage + 1);
  const to = Math.min(total, page * perPage);
  return (
    <nav className="site-pager" aria-label={`${what} pages`}>
      <p aria-live="polite">{from}–{to} of {total}</p>
      <div className="flex gap-2">
        <button type="button" className="btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="site-pager-n">Page {page} of {pages}</span>
        <button type="button" className="btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </nav>
  );
}

/** An on/off switch (a real button: Space and Enter work, screen readers hear "switch, on"). */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="site-switch" disabled={disabled} onClick={() => onChange(!on)}>
      <span aria-hidden="true" />
    </button>
  );
}

export function SearchBox({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  return (
    <label className="site-search">
      <span className="sr-only">{label}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
      <input type="search" className="field" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={200} />
    </label>
  );
}

/** Change query params in place (Next keeps useSearchParams in sync with history.replaceState(null, …)). */
export function setUrl(patch: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  window.history.replaceState(null, "", url);
}
export const setUrlChat = (id: string | null) => setUrl({ chat: id });

export const openModal = (d: HTMLDialogElement | null) => { if (d && !d.open) d.showModal(); };
