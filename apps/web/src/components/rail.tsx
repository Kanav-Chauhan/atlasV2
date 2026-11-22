"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

// Icon paths from previews/dashboard/option-c (24x24, stroke).
const ICONS: Record<string, React.ReactNode> = {
  "": <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  ask: <path d="M4 5h16v11H9l-5 4z" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
  library: <path d="M5 4h4v16H5zM10 4h4v16h-4zM15.5 5l3.8-1 3.2 15.5-3.8.8z" />,
  team: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.8.7 3 2.4 3.5 5.2" /></>,
  "website-chat": <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 8h18M14 13h4" /></>,
  insights: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  "agent-access": <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
};

export function RailDests({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <div className="rail-dests">
      {items.map(({ slug, label }) => {
        const href = slug ? `/app/${slug}` : "/app";
        return (
          <Link key={slug} className="dest" href={href} aria-current={path === href ? "page" : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{ICONS[slug]}</svg>
            {label}
          </Link>
        );
      })}
    </div>
  );
}
