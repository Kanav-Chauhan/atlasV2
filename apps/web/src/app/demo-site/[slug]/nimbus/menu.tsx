"use client";
import { useRef } from "react";

// Phone menu: a <details> that also closes after a link is picked.
export function MobileMenu({ links, cta }: { links: [string, string][]; cta: [string, string] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute("open");
  return (
    <details className="nb-menu" ref={ref}>
      <summary>
        <span className="nb-sr">Menu</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </summary>
      <nav aria-label="Mobile">
        {links.map(([href, label]) => <a key={href} href={href} onClick={close}>{label}</a>)}
        <a className="nb-btn nb-btn-primary" href={cta[0]} onClick={close}>{cta[1]}</a>
      </nav>
    </details>
  );
}
