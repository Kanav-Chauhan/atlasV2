"use client";

import { useState } from "react";

// Phone-width menu: a button that opens the nav as a panel under the header and closes on any link.
export function MobileMenu({ links }: { links: [string, string][] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sj-mmenu">
      <button type="button" className="sj-mmenu-btn" aria-expanded={open} aria-controls="sj-mmenu-panel" onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </g>
        </svg>
        <span>{open ? "Close" : "Menu"}</span>
      </button>
      <nav id="sj-mmenu-panel" className="sj-mmenu-panel" aria-label="Main (mobile)" hidden={!open}>
        <ul>
          {links.map(([href, label]) => (
            <li key={href}><a href={href} onClick={() => setOpen(false)}>{label}</a></li>
          ))}
          <li><a className="sj-btn sj-btn-alert" href="#safety" onClick={() => setOpen(false)}>Report a side effect</a></li>
        </ul>
      </nav>
    </div>
  );
}
