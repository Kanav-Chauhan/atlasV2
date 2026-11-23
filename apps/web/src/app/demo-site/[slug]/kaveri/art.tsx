// Drawn SVG art for the Kaveri site: riskometer, growth chart, icons and illustrations.
// All decorative pieces are aria-hidden; charts carry a text alternative.
import { FUNDS, RISK_LEVELS, type Risk } from "./data";

const RISK_COLOURS = ["#2E7D32", "#7CB342", "#F2C200", "#F59E0B", "#E8590C", "#C62828"];

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** Semicircular riskometer gauge with six SEBI levels and a needle. */
export function Riskometer({ level, size = 96 }: { level: Risk; size?: number }) {
  const i = RISK_LEVELS.indexOf(level);
  const angle = 180 + 30 * i + 15; // middle of the segment
  const nx = 50 + 30 * Math.cos((angle * Math.PI) / 180);
  const ny = 52 + 30 * Math.sin((angle * Math.PI) / 180);
  return (
    <svg viewBox="0 0 100 58" width={size} height={(size * 58) / 100} role="img" aria-label={`Riskometer: ${level}`}>
      {RISK_COLOURS.map((c, k) => (
        <path key={c} d={arc(50, 52, 40, 180 + 30 * k + 1, 180 + 30 * (k + 1) - 1)} stroke={c} strokeWidth="12" fill="none" opacity={k === i ? 1 : 0.38} />
      ))}
      <line x1="50" y1="52" x2={nx.toFixed(2)} y2={ny.toFixed(2)} stroke="#0f1450" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="52" r="4.5" fill="#0f1450" />
    </svg>
  );
}

/** Growth of ₹10,000 in Kaveri Bluechip (Direct, Growth) vs Nifty 100 TRI. The points are worked
 *  backwards from the factsheet's "value of ₹10,000" table: value N years ago = since-inception value ÷ N-year value × 10,000. */
export function GrowthChart() {
  const f = FUNDS[0];
  const si = f.returns[3];
  const pts = (key: "fundVal" | "benchVal") => [
    { t: 0, v: 10000 },
    { t: 4.24, v: (si[key] / f.returns[2][key]) * 10000 },
    { t: 6.24, v: (si[key] / f.returns[1][key]) * 10000 },
    { t: 8.24, v: (si[key] / f.returns[0][key]) * 10000 },
    { t: 9.24, v: si[key] },
  ];
  const W = 440, H = 210, L = 44, R = 12, T = 14, B = 28;
  const x = (t: number) => L + (t / 9.24) * (W - L - R);
  const y = (v: number) => T + (1 - (v - 5000) / (40000 - 5000)) * (H - T - B);
  const line = (p: { t: number; v: number }[]) => p.map((q, k) => `${k ? "L" : "M"}${x(q.t).toFixed(1)} ${y(q.v).toFixed(1)}`).join(" ");
  const fund = pts("fundVal");
  const bench = pts("benchVal");
  const area = `${line(fund)} L${x(9.24)} ${y(5000)} L${x(0)} ${y(5000)} Z`;
  const ticks = [10000, 20000, 30000, 40000];
  const years = [{ t: 0, l: "Jan 2017" }, { t: 4.24, l: "Mar 2021" }, { t: 6.24, l: "Mar 2023" }, { t: 9.24, l: "Mar 2026" }];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="kv-growth" role="img"
      aria-label="Growth of ₹10,000 invested in Kaveri Bluechip Fund (Direct, Growth) at inception on 2 January 2017: ₹36,420 on 31 March 2026, against ₹32,494 for the Nifty 100 TRI.">
      <defs>
        <linearGradient id="kv-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C9A227" stopOpacity="0.32" />
          <stop offset="1" stopColor="#C9A227" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e3e5ef" strokeDasharray={v === 10000 ? "0" : "3 4"} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" className="kv-axis">₹{v / 1000}k</text>
        </g>
      ))}
      {years.map((q) => (
        <text key={q.l} x={x(q.t)} y={H - 8} textAnchor={q.t === 0 ? "start" : q.t > 9 ? "end" : "middle"} className="kv-axis">{q.l}</text>
      ))}
      <path d={area} fill="url(#kv-area)" />
      <path d={line(bench)} fill="none" stroke="#9aa1c7" strokeWidth="2" strokeDasharray="5 4" />
      <path d={line(fund)} fill="none" stroke="#1A237E" strokeWidth="2.6" strokeLinejoin="round" />
      {fund.map((q) => <circle key={q.t} cx={x(q.t)} cy={y(q.v)} r="3.4" fill="#fff" stroke="#1A237E" strokeWidth="2" />)}
      <circle cx={x(9.24)} cy={y(si.fundVal)} r="5" fill="#C9A227" stroke="#1A237E" strokeWidth="2" />
    </svg>
  );
}

/** Hero backdrop: river contours flowing across the navy band. */
export function RiverLines() {
  return (
    <svg className="kv-river" viewBox="0 0 1440 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" strokeWidth="1.2">
        {Array.from({ length: 9 }, (_, k) => (
          <path key={k} stroke={k % 3 === 0 ? "rgba(201,162,39,.35)" : "rgba(255,255,255,.08)"}
            d={`M-20 ${300 + k * 22} C 240 ${220 + k * 18}, 420 ${420 + k * 10}, 720 ${330 + k * 16} S 1180 ${200 + k * 20}, 1460 ${280 + k * 18}`} />
        ))}
      </g>
    </svg>
  );
}

const I = {
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  rupee: <><path d="M7 5h10M7 9h10M7 5c5 0 6 2.2 6 4s-1.5 4-6 4l7 6" /></>,
  doc: <><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20Z" /><path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5" /></>,
  shield: <><path d="M12 3.5 19 6v5.5c0 4.3-3 7.5-7 9-4-1.5-7-4.7-7-9V6Z" /><path d="m9 12 2 2 4-4" /></>,
  swap: <><path d="M5 8h13l-3-3M19 16H6l3 3" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  phone: <><path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A15 15 0 0 1 5 5.6 1.5 1.5 0 0 1 6.5 4Z" /></>,
  mail: <><rect x="3.5" y="6" width="17" height="12" rx="1.5" /><path d="m4 7 8 6 8-6" /></>,
  pin: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
  arrow: <><path d="M5 12h13M13 7l5 5-5 5" /></>,
  bank: <><path d="M4 9.5 12 5l8 4.5M5.5 10v7M10 10v7M14 10v7M18.5 10v7M4 19.5h16" /></>,
  chart: <><path d="M4 19.5h16M7 16v-4M11 16V8M15 16v-6M19 16V5" /></>,
};
export type IconName = keyof typeof I;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {I[name]}
    </svg>
  );
}

/** Cut-off timeline: a business day from 9 am to 11 pm with the 3 pm cut-off and NAV publication. */
export function CutoffTimeline() {
  const x = (h: number) => 20 + ((h - 9) / 14) * 560;
  const marks: [number, string, string][] = [
    [15, "3:00 pm", "Cut-off"],
    [15.5, "3:30 pm", "Market close"],
    [22.5, "10:30 pm", "NAV on our site"],
    [23, "11:00 pm", "Kaveri & AMFI"],
  ];
  return (
    <svg viewBox="0 0 600 120" className="kv-timeline" role="img"
      aria-label="Requests received before the 3:00 pm cut-off get the same day's NAV; after it, the next business day's NAV. NAV is published by 11:00 pm on the Kaveri and AMFI websites.">
      <rect x={x(9)} y="46" width={x(15) - x(9)} height="14" rx="7" fill="#1A237E" />
      <rect x={x(15)} y="46" width={x(23) - x(15)} height="14" rx="7" fill="#d9dcef" />
      <text x={x(12)} y="36" textAnchor="middle" className="kv-tl-band">Same day&apos;s NAV</text>
      <text x={x(19)} y="36" textAnchor="middle" className="kv-tl-band kv-tl-muted">Next business day&apos;s NAV</text>
      {marks.map(([h, t, l], k) => (
        <g key={t}>
          <line x1={x(h)} x2={x(h)} y1="42" y2="66" stroke={k === 0 ? "#C9A227" : "#5c6399"} strokeWidth={k === 0 ? 3 : 1.4} />
          <text x={x(h)} y={k % 2 ? 100 : 84} textAnchor={k === 3 ? "end" : k === 2 ? "end" : "middle"} className="kv-tl-time">{t} · {l}</text>
        </g>
      ))}
      <text x={x(9)} y="84" className="kv-tl-time">9:00 am</text>
    </svg>
  );
}

/** Careers illustration: an open notebook with a rising line and a pen. */
export function NotebookArt() {
  return (
    <svg viewBox="0 0 320 220" className="kv-art" aria-hidden="true">
      <ellipse cx="160" cy="200" rx="130" ry="10" fill="#1A237E" opacity=".08" />
      <path d="M40 40c40-12 80-10 120 6v150c-40-16-80-18-120-6Z" fill="#fff" stroke="#1A237E" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M280 40c-40-12-80-10-120 6v150c40-16 80-18 120-6Z" fill="#f7f4ea" stroke="#1A237E" strokeWidth="2.5" strokeLinejoin="round" />
      {[70, 90, 110, 130].map((y) => <path key={y} d={`M58 ${y}c28-7 58-6 86 3`} stroke="#c5c9e4" strokeWidth="2" fill="none" />)}
      <path d="M178 150l22-22 18 12 22-34 22-18" fill="none" stroke="#C9A227" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {[[178, 150], [200, 128], [218, 140], [240, 106], [262, 88]].map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r="4" fill="#fff" stroke="#1A237E" strokeWidth="2" />)}
      <path d="M176 168h90" stroke="#1A237E" strokeWidth="2" />
      <g transform="rotate(-38 250 50)"><rect x="200" y="44" width="92" height="12" rx="3" fill="#1A237E" /><path d="M292 44l14 6-14 6Z" fill="#C9A227" /></g>
    </svg>
  );
}

/** "Talk to us" illustration: two speech cards and a rupee coin. */
export function AdviceArt() {
  return (
    <svg viewBox="0 0 240 150" className="kv-art" aria-hidden="true">
      <rect x="18" y="20" width="130" height="64" rx="14" fill="#fff" opacity=".96" />
      <path d="M40 84l-6 18 22-18" fill="#fff" opacity=".96" />
      {[38, 52, 66].map((y, k) => <rect key={y} x="34" y={y} width={k === 2 ? 60 : 96} height="6" rx="3" fill="#c5c9e4" />)}
      <rect x="96" y="70" width="124" height="56" rx="14" fill="#C9A227" />
      <path d="M196 126l8 16-24-16" fill="#C9A227" />
      {[86, 100].map((y, k) => <rect key={y} x="112" y={y} width={k ? 56 : 90} height="6" rx="3" fill="#1A237E" opacity=".55" />)}
      <circle cx="196" cy="34" r="20" fill="none" stroke="#C9A227" strokeWidth="3" />
      <path d="M189 25h14M189 31h14M189 25c6 0 7 2.5 7 4.5s-2 4.5-7 4.5l9 8" stroke="#C9A227" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** About illustration: a river winding past a city skyline (Bengaluru, drawn loosely). */
export function CityRiverArt() {
  return (
    <svg viewBox="0 0 420 260" className="kv-art" aria-hidden="true">
      <rect x="0" y="0" width="420" height="260" rx="20" fill="#eef0f9" />
      <circle cx="330" cy="62" r="26" fill="#C9A227" opacity=".85" />
      <g fill="#1A237E">
        <rect x="40" y="110" width="34" height="80" rx="2" opacity=".55" />
        <rect x="80" y="80" width="40" height="110" rx="2" />
        <rect x="126" y="124" width="30" height="66" rx="2" opacity=".55" />
        <rect x="162" y="96" width="46" height="94" rx="2" opacity=".8" />
        <rect x="214" y="132" width="28" height="58" rx="2" opacity=".55" />
        <rect x="248" y="70" width="36" height="120" rx="2" />
        <rect x="290" y="118" width="40" height="72" rx="2" opacity=".7" />
        <rect x="336" y="140" width="44" height="50" rx="2" opacity=".5" />
      </g>
      <g fill="#fff" opacity=".7">
        {[90, 104, 118, 132, 146, 160].map((y) => <rect key={y} x="88" y={y} width="24" height="4" rx="1" />)}
        {[82, 96, 110, 124, 138, 152, 166].map((y) => <rect key={y} x="256" y={y} width="20" height="4" rx="1" />)}
      </g>
      <path d="M0 196h420v64H0Z" fill="#dfe3f4" />
      <path d="M-10 214c70-18 120 22 200 6s130-26 240 0" stroke="#1A237E" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".85" />
      <path d="M-10 236c80-14 140 18 220 4s120-20 220 2" stroke="#C9A227" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Small social icons for the footer (generic shapes, no brand marks). */
export function SocialIcon({ kind }: { kind: "in" | "x" | "yt" | "ig" }) {
  const body = {
    in: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.5 10.5V16M8.5 7.8v.1M12 16v-3.2c0-1.5 1-2.3 2-2.3s2 .7 2 2.3V16M12 10.5V16" /></>,
    x: <><path d="M5 5l14 14M19 5 5 19" /></>,
    yt: <><rect x="3.5" y="6.5" width="17" height="11" rx="3.5" /><path d="m10.5 9.8 4 2.2-4 2.2Z" /></>,
    ig: <><rect x="4" y="4" width="16" height="16" rx="4.5" /><circle cx="12" cy="12" r="3.6" /><path d="M16.6 7.4v.1" /></>,
  }[kind];
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{body}</svg>
  );
}
