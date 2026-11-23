// The one page frame every dashboard page uses (app/app/dash.css "Page"): same width, same top
// spacing, same header (title, one-line description, primary action on the right).
// Pages that were built before this file get the same look from the CSS alone
// (.app > main > .mx-auto and its first <header>), so they can move to these components later.

export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`page ${className}`}>{children}</div>;
}

export function PageHeader({ title, description, eyebrow, actions }: {
  title: React.ReactNode; description?: React.ReactNode; eyebrow?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

/** A surface card with an optional header row (title, note, link or action on the right). */
export function Card({ title, note, action, id, tone, className = "", children }: {
  title?: React.ReactNode; note?: React.ReactNode; action?: React.ReactNode; id?: string;
  tone?: "accent" | "warn" | "error" | "success" | "info"; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={`card ${className}`} data-tone={tone} aria-labelledby={title && id ? `${id}-h` : undefined}>
      {(title || action) && (
        <div className="card-head">
          <div className="min-w-0">
            {title && <h2 id={id ? `${id}-h` : undefined}>{title}</h2>}
            {note && <p>{note}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
