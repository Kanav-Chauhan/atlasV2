// The Atlas globe mark from the option C rail.
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="12" />
      <path d="M4 16h24M16 4c4 4 4 20 0 24M16 4c-4 4-4 20 0 24" />
    </svg>
  );
}
