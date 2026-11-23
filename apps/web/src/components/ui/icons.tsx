// One inline stroke icon set for the whole app (24x24, 1.8 stroke, currentColor). No icon font or CDN.
// The rail's shapes come from previews/dashboard/option-c; the rest are drawn to match.

const PATHS = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  ask: <path d="M4 5h16v11H9l-5 4z" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
  library: <path d="M5 4h4v16H5zM10 4h4v16h-4zM15.5 5l3.8-1 3.2 15.5-3.8.8z" />,
  team: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.8.7 3 2.4 3.5 5.2" /></>,
  website: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 8h18M14 13h4" /></>,
  insights: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  agents: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  lab: <path d="M9 3h6M10 3v6l-5.6 9.6A1.6 1.6 0 0 0 5.8 21h12.4a1.6 1.6 0 0 0 1.4-2.4L14 9V3M7.5 15h9" />,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  logout: <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  send: <path d="M5 12h13M12 5l7 7-7 7" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  alert: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  check: <><circle cx="12" cy="12" r="8.5" /><path d="M8.2 12.3l2.6 2.6 5-5.4" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  fileQuestion: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M10 11.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3M12 17.3v.2" /></>,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />,
  history: <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 8v4.5l3 2" />,
  book: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-5", label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {PATHS[name]}
    </svg>
  );
}

/** Rail slug → icon. */
export const NAV_ICON: Record<string, IconName> = {
  "": "home", ask: "ask", search: "search", library: "library", team: "team",
  website: "website", insights: "insights", agents: "agents", settings: "settings", lab: "lab",
};
