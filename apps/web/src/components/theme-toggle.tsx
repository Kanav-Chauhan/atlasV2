"use client";

// Flips light/dark on <html data-theme> and remembers it (same key as the design previews).
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme");
    const dark = current === "dark" || (!current && matchMedia("(prefers-color-scheme: dark)").matches);
    const next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("atlas-theme", next);
    } catch {}
  }
  return (
    <button type="button" className={className} onClick={toggle} aria-label="Switch light or dark mode">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    </button>
  );
}
