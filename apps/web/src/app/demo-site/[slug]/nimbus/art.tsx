// Drawn illustrations and icons for the Nimbus demo website (owner's choice: drawings only, no photos).
// All decorative: every SVG here is aria-hidden; the text next to it carries the meaning.

const C = {
  blue: "#1E88E5", blueDeep: "#1565C0", sky: "#E3F0FC", sky2: "#CFE4FA", navy: "#0D2B4E", navy2: "#173F6B",
  slot: "#2E5C8F", green: "#2E9E6A", greenSoft: "#E3F5EC", amber: "#FFB300", grey: "#B8C7D9", white: "#FFFFFF",
};

/* Hero: the cloud (NimbusOps / services) feeding the three delivery centres, with two floating product cards. */
function Stack({ x, units, label }: { x: number; units: number; label: string }) {
  const tops = Array.from({ length: units }, (_, i) => 396 - i * 40);
  return (
    <g>
      {tops.map((y, i) => (
        <g key={y}>
          <rect x={x - 58} y={y} width="116" height="34" rx="7" fill={i === units - 1 ? C.navy2 : C.navy} />
          <circle cx={x - 42} cy={y + 17} r="4" fill={i % 2 ? "#4FC3F7" : "#5BD69A"} />
          <circle cx={x - 29} cy={y + 17} r="4" fill={C.slot} />
          <path d={`M${x - 12} ${y + 12}h56M${x - 12} ${y + 22}h40`} stroke={C.slot} strokeWidth="3" strokeLinecap="round" />
        </g>
      ))}
      <text x={x} y="460" textAnchor="middle" fontSize="14" fontWeight="600" fill={C.navy}>{label}</text>
    </g>
  );
}

export function HeroArt() {
  return (
    <svg className="nb-hero-art" viewBox="0 0 600 480" aria-hidden="true" focusable="false">
      <defs>
        <filter id="nb-sh" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor={C.navy} floodOpacity="0.14" />
        </filter>
        <linearGradient id="nb-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5AB0F2" />
          <stop offset="1" stopColor={C.blue} />
        </linearGradient>
        <linearGradient id="nb-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.blue} stopOpacity="0.28" />
          <stop offset="1" stopColor={C.blue} stopOpacity="0" />
        </linearGradient>
        <pattern id="nb-dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" fill={C.sky2} />
        </pattern>
      </defs>

      <rect x="30" y="20" width="540" height="430" rx="36" fill="url(#nb-dots)" />
      <circle cx="300" cy="250" r="196" fill={C.sky} />
      <ellipse cx="300" cy="432" rx="250" ry="20" fill={C.sky2} />

      {/* connectors from the cloud to each centre */}
      <g fill="none" stroke={C.blue} strokeWidth="3" strokeLinecap="round">
        <path className="nb-flow" d="M258 188C258 236 150 236 150 312" />
        <path className="nb-flow" d="M300 192V272" />
        <path className="nb-flow" d="M342 188C342 236 450 236 450 312" />
      </g>
      <circle cx="206" cy="236" r="6" fill={C.amber} />
      <circle cx="394" cy="236" r="6" fill={C.amber} />

      {/* the cloud, with the logo's code brackets */}
      <g filter="url(#nb-sh)">
        <g fill="url(#nb-cloud)">
          <circle cx="250" cy="140" r="46" />
          <circle cx="305" cy="106" r="62" />
          <circle cx="362" cy="140" r="44" />
          <rect x="204" y="136" width="202" height="52" rx="26" />
        </g>
      </g>
      <path d="M288 124l-16 16 16 16M322 124l16 16-16 16" fill="none" stroke={C.white} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />

      <Stack x={150} units={3} label="Pune" />
      <Stack x={300} units={4} label="Bengaluru" />
      <Stack x={450} units={3} label="Hyderabad" />

      {/* floating card: alert resolved */}
      <g transform="translate(14 74)" filter="url(#nb-sh)">
        <rect width="176" height="66" rx="14" fill={C.white} />
        <circle cx="32" cy="33" r="16" fill={C.greenSoft} />
        <path d="M24.5 33.5l5 5 9-10" fill="none" stroke={C.green} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="58" y="21" width="96" height="9" rx="4.5" fill={C.navy} />
        <rect x="58" y="38" width="66" height="8" rx="4" fill={C.grey} />
      </g>

      {/* floating card: metric chart */}
      <g transform="translate(414 26)" filter="url(#nb-sh)">
        <rect width="166" height="112" rx="14" fill={C.white} />
        <rect x="16" y="16" width="54" height="8" rx="4" fill={C.grey} />
        <rect x="124" y="14" width="26" height="12" rx="6" fill={C.greenSoft} />
        <path d="M16 84 36 72 56 77 76 58 96 64 116 46 150 52V96H16Z" fill="url(#nb-area)" />
        <path d="M16 84 36 72 56 77 76 58 96 64 116 46 150 52" fill="none" stroke={C.blue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="116" cy="46" r="4.5" fill={C.white} stroke={C.blue} strokeWidth="3" />
      </g>

      {/* shield badge (security) and bell chip (notifications) */}
      <g transform="translate(530 300)" filter="url(#nb-sh)">
        <circle r="28" fill={C.white} />
        <path d="M0-14 11-9.5v8C11 6 6 11.5 0 14-6 11.5-11 6-11-1.5v-8Z" fill={C.blue} />
        <path d="M-4.5 0l3 3 6-6.5" fill="none" stroke={C.white} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(64 300)" filter="url(#nb-sh)">
        <circle r="26" fill={C.white} />
        <path d="M-9 5V-2a9 9 0 0 1 18 0v7l3 3h-24Z" fill={C.navy} />
        <path d="M-3 11a3 3 0 0 0 6 0" fill="none" stroke={C.navy} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="9" cy="-10" r="5" fill={C.amber} />
      </g>

      {/* sparkles */}
      <path d="M520 196v16M512 204h16" stroke={C.amber} strokeWidth="3" strokeLinecap="round" />
      <path d="M96 212v12M90 218h12" stroke={C.blue} strokeWidth="3" strokeLinecap="round" />
      <circle cx="210" cy="36" r="5" fill={C.sky2} />
    </svg>
  );
}

/* Small line icons, 24 grid, drawn in currentColor with a soft fill. */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const ICONS: Record<string, React.ReactNode> = {
  cloud: <><path {...P} d="M7 18h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7 9.2 4.4 4.4 0 0 0 7 18Z" /><path {...P} d="M9 14h6M12 11v6" /></>,
  data: <><path {...P} d="M4 20V10M9 20V4M14 20v-7M19 20v-11" /><circle cx="19" cy="6" r="2" fill="currentColor" /></>,
  apps: <><rect {...P} x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect {...P} x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect {...P} x="3.5" y="13.5" width="7" height="7" rx="1.5" /><path {...P} d="M17 13.5v7M13.5 17h7" /></>,
  ops: <><path {...P} d="M12 3 19.5 6v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6Z" /><path {...P} d="M9 12h1.5l1.2-2.5 2 5L15 12h1" /></>,
  agent: <><rect {...P} x="4" y="4" width="16" height="6" rx="1.5" /><rect {...P} x="4" y="14" width="16" height="6" rx="1.5" /><path {...P} d="M7.5 7h.01M7.5 17h.01M11 7h5M11 17h5" /></>,
  timer: <><circle {...P} cx="12" cy="13" r="7.5" /><path {...P} d="M12 9.5V13l2.5 1.5M10 3h4" /></>,
  bell: <><path {...P} d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" /><path {...P} d="M10 20.5a2 2 0 0 0 4 0" /></>,
  uptime: <><path {...P} d="M3 12h4l2-5 4 10 2-5h6" /></>,
  india: <><path {...P} d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle {...P} cx="12" cy="10" r="2.4" /></>,
  lock: <><rect {...P} x="5" y="10.5" width="14" height="10" rx="2" /><path {...P} d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3M12 14.5v2" /></>,
  plug: <><path {...P} d="M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0ZM12 16.5V21" /></>,
  check: <path {...P} d="m5 12.5 4.5 4.5L19 7.5" />,
  dash: <path {...P} d="M8 12h8" />,
  seal: <><circle {...P} cx="12" cy="10" r="6" /><path {...P} d="m9.5 10 1.8 1.8 3.4-3.6M8.5 15l-1.5 6 5-2.5 5 2.5-1.5-6" /></>,
  arrow: <path {...P} d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" />,
};

export function Icon({ name, className }: { name: keyof typeof ICONS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "nb-ico"} aria-hidden="true" focusable="false">{ICONS[name]}</svg>
  );
}

/* Offices: four small drawn buildings, each a different silhouette. */
export function OfficeArt({ kind }: { kind: "pune" | "blr" | "hyd" | "dxb" }) {
  const ground = <path d="M6 70h108" stroke={C.sky2} strokeWidth="3" strokeLinecap="round" />;
  const win = (x: number, y: number, cols: number, rows: number, w = 6, gap = 10) =>
    Array.from({ length: cols * rows }, (_, i) => (
      <rect key={i} x={x + (i % cols) * gap} y={y + Math.floor(i / cols) * 10} width={w} height="5" rx="1" fill={C.white} opacity="0.85" />
    ));
  return (
    <svg viewBox="0 0 120 76" className="nb-office-art" aria-hidden="true" focusable="false">
      <circle cx="94" cy="20" r="10" fill={C.sky} />
      {kind === "pune" && <>
        <rect x="22" y="14" width="38" height="56" rx="3" fill={C.blue} />{win(28, 20, 3, 5)}
        <rect x="62" y="32" width="34" height="38" rx="3" fill={C.navy} />{win(67, 38, 3, 3)}
        <path d="M22 14h38" stroke={C.navy} strokeWidth="3" />
      </>}
      {kind === "blr" && <>
        <rect x="18" y="30" width="56" height="40" rx="3" fill={C.navy} />{win(24, 36, 5, 3)}
        <rect x="76" y="20" width="24" height="50" rx="3" fill={C.blue} />{win(81, 26, 2, 4, 5, 9)}
        <circle cx="12" cy="56" r="8" fill="#7CC39A" /><path d="M12 62v8" stroke={C.green} strokeWidth="2.5" />
      </>}
      {kind === "hyd" && <>
        <path d="M24 70V26l22-12v56Z" fill={C.blue} />
        <rect x="48" y="24" width="30" height="46" rx="3" fill={C.navy} />{win(53, 30, 2, 4, 6, 12)}
        <path d="M82 70V40l18 8v22Z" fill={C.blueDeep} />
      </>}
      {kind === "dxb" && <>
        <path d="M54 70V18l6-12 6 12v52Z" fill={C.navy} />
        <rect x="30" y="40" width="20" height="30" rx="2" fill={C.blue} />{win(34, 45, 2, 3, 4, 7)}
        <rect x="70" y="34" width="22" height="36" rx="2" fill={C.blueDeep} />{win(74, 40, 2, 3, 5, 8)}
      </>}
      {ground}
    </svg>
  );
}

/* Social glyphs: simple generic marks, not the networks' real logos. */
export function Social({ kind }: { kind: "in" | "x" | "yt" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="nb-social-ico">
      {kind === "in" && <><path d="M7 10v7M7 7v.01M11 17v-7M11 13a3 3 0 0 1 6 0v4" {...P} strokeWidth={2} /></>}
      {kind === "x" && <path d="M6 6l12 12M18 6 6 18" {...P} strokeWidth={2} />}
      {kind === "yt" && <><rect x="3.5" y="6.5" width="17" height="11" rx="3.5" {...P} strokeWidth={1.8} /><path d="M10.5 9.8v4.4l3.8-2.2Z" fill="currentColor" /></>}
    </svg>
  );
}

/* The NimbusOps product mock-up: drawn in HTML/SVG, sample data only. */
export function Dashboard() {
  const nav = ["Overview", "Hosts", "Alerts", "Logs", "Integrations", "Settings"];
  const tiles: [string, string, string][] = [["Hosts reporting", "1,248", "ok"], ["Open alerts", "3", "warn"], ["Rules evaluated", "every 30 s", "ok"], ["Log volume", "Normal", "ok"]];
  const alerts: [string, string, string, string][] = [
    ["crit", "Critical", "Disk 91% on db-prod-02", "PagerDuty"],
    ["warn", "Warning", "Memory pressure on k8s-node-14", "Slack"],
    ["ok", "Resolved", "CPU back to normal on web-07", "Microsoft Teams"],
  ];
  return (
    <div className="nb-dash" aria-hidden="true">
      <div className="nb-dash-top">
        <span className="nb-dash-brand"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill={C.blue} /><path d="M10 22.5h12.5a4.5 4.5 0 0 0 .6-8.96A6.5 6.5 0 0 0 10.6 12 5.25 5.25 0 0 0 10 22.5Z" fill="none" stroke="#fff" strokeWidth="2" /></svg>NimbusOps</span>
        <span className="nb-dash-env">Production</span>
        <span className="nb-dash-search">Search hosts, alerts, logs</span>
        <span className="nb-dash-avatar">NG</span>
      </div>
      <div className="nb-dash-body">
        <ul className="nb-dash-nav">
          {nav.map((n, i) => <li key={n} data-on={i === 0 || undefined}><span />{n}</li>)}
        </ul>
        <div className="nb-dash-main">
          <div className="nb-dash-tiles">
            {tiles.map(([k, v, t]) => <div key={k} data-tone={t}><small>{k}</small><b>{v}</b></div>)}
          </div>
          <div className="nb-dash-chart">
            <div className="nb-dash-h"><b>CPU, web tier</b><small>Last 6 hours</small></div>
            <svg viewBox="0 0 520 170" preserveAspectRatio="none">
              <defs>
                <linearGradient id="nb-dash-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.blue} stopOpacity="0.22" /><stop offset="1" stopColor={C.blue} stopOpacity="0" /></linearGradient>
              </defs>
              {[30, 70, 110, 150].map((y) => <path key={y} d={`M0 ${y}H520`} stroke="#E6EDF5" strokeWidth="1" />)}
              <path d="M0 40H520" stroke="#E5484D" strokeWidth="1.5" strokeDasharray="6 6" />
              <path d="M0 120 40 112 80 118 120 96 160 104 200 84 240 92 280 58 300 48 320 70 360 88 400 80 440 96 480 86 520 92V170H0Z" fill="url(#nb-dash-a)" />
              <path d="M0 120 40 112 80 118 120 96 160 104 200 84 240 92 280 58 300 48 320 70 360 88 400 80 440 96 480 86 520 92" fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M0 140 40 136 80 138 120 128 160 132 200 124 240 128 280 116 320 120 360 126 400 122 440 128 480 124 520 126" fill="none" stroke="#7FB8EE" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="300" cy="48" r="5" fill="#fff" stroke="#E5484D" strokeWidth="2.5" />
            </svg>
          </div>
          <div className="nb-dash-alerts">
            <div className="nb-dash-h"><b>Recent alerts</b><small>Notified</small></div>
            <ul>
              {alerts.map(([t, sev, msg, via]) => (
                <li key={msg}><span className="nb-sev" data-tone={t}>{sev}</span><span className="nb-dash-msg">{msg}</span><span className="nb-dash-via">{via}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Career grades drawn as a staircase. */
export function Ladder({ grades }: { grades: [string, string][] }) {
  return (
    <ol className="nb-ladder">
      {grades.map(([g, t], i) => (
        <li key={g} style={{ ["--step" as string]: i }}><b>{g}</b><span>{t}</span></li>
      ))}
    </ol>
  );
}
