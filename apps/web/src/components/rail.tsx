"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, NAV_ICON } from "@/components/ui/icons";
import type { NavGroup } from "@/lib/nav";

// Grouped rail: "Work" and "Manage" with small labels (labels only when a role has both groups).
// Desktop: labelled sidebar. Phone: one bottom bar, labels hidden (shell.css).
export function RailDests({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const labelled = groups.length > 1;
  return (
    <div className="rail-dests">
      {groups.map((g) => (
        <div key={g.label} className="rail-group" role="group" aria-labelledby={labelled ? `rail-${g.label}` : undefined}>
          {labelled && <p id={`rail-${g.label}`} className="rail-label">{g.label}</p>}
          {g.items.map(({ slug, label }) => {
            const href = slug ? `/app/${slug}` : "/app";
            const here = slug ? path === href || path.startsWith(`${href}/`) : path === href;
            return (
              <Link key={slug} className="dest" href={href} aria-current={here ? "page" : undefined}>
                <Icon name={NAV_ICON[slug]} className="dest-icon" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
