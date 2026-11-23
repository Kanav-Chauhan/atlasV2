// Drawn illustrations and icons for the Sanjeevani demo site. All decorative (aria-hidden),
// coloured through CSS custom properties set on .sj-site so the palette lives in one place.

const T = "var(--sj-teal)";
const TD = "var(--sj-teal-deep)";
const TL = "var(--sj-teal-tint)";
const S = "var(--sj-saffron)";
const SL = "var(--sj-saffron-tint)";
const W = "var(--sj-white)";
const INK = "var(--sj-line)";

/* ---------- Hero: carton, blister strip, syrup bottle and cream tube on a molecule field ---------- */
export function HeroArt() {
  return (
    <svg className="sj-hero-art" viewBox="0 0 560 480" aria-hidden="true" focusable="false">
      {/* backdrop */}
      <circle cx="300" cy="250" r="200" fill={TL} />
      <circle cx="300" cy="250" r="200" fill="none" stroke={T} strokeOpacity=".18" strokeWidth="1.5" strokeDasharray="2 8" />
      {/* molecule network */}
      <g stroke={T} strokeWidth="2" fill="none" strokeOpacity=".55">
        <path d="M74 120 l26 -15 l26 15 v30 l-26 15 l-26 -15z" />
        <path d="M126 120 l30 -10 M100 165 v28 M156 110 l24 14" />
        <path d="M454 76 l22 -13 l22 13 v26 l-22 13 l-22 -13z" />
        <path d="M476 115 v26 M498 89 l24 -10" />
      </g>
      <g fill={W} stroke={T} strokeWidth="2">
        <circle cx="156" cy="110" r="6" /><circle cx="180" cy="124" r="5" /><circle cx="100" cy="193" r="6" />
        <circle cx="476" cy="141" r="6" /><circle cx="522" cy="79" r="5" />
      </g>
      <circle cx="180" cy="124" r="5" fill={S} />
      <circle cx="522" cy="79" r="5" fill={S} />

      {/* leaves behind the packs */}
      <g>
        <path d="M108 372c-6-70 34-118 112-126 4 76-38 122-112 126Z" fill={T} />
        <path d="M108 372c30-38 62-72 104-118" stroke={W} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M150 318l-22-12M172 292l-20-16M140 336l24 2M164 306l26 0" stroke={W} strokeWidth="2" strokeLinecap="round" opacity=".7" />
        <path d="M470 380c18-58-6-104-66-124-22 60 4 106 66 124Z" fill={TD} />
        <path d="M470 380c-14-40-34-82-64-122" stroke={W} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".8" />
      </g>

      {/* carton */}
      <g>
        <path d="M200 176 l118 -26 l46 22 l-118 26z" fill={W} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M200 176 v170 l46 22 v-170z" fill={TL} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M246 198 l118 -26 v170 l-118 26z" fill={W} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M246 236 l118 -26 v44 l-118 26z" fill={T} />
        <path d="M262 288 l60 -13" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity=".35" />
        <path d="M262 304 l84 -18" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity=".2" />
        <path d="M262 320 l46 -10" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity=".2" />
        <circle cx="342" cy="318" r="12" fill={S} />
        <path d="M342 311 v14 M335 318 h14" stroke={W} strokeWidth="3" strokeLinecap="round" />
        <path d="M262 258 l34 -7" stroke={W} strokeWidth="4" strokeLinecap="round" />
        <path d="M262 270 l20 -4" stroke={W} strokeWidth="3" strokeLinecap="round" opacity=".7" />
      </g>

      {/* blister strip, tilted in front */}
      <g transform="rotate(-14 300 392)">
        <rect x="206" y="356" width="196" height="74" rx="10" fill="var(--sj-foil)" stroke={INK} strokeWidth="2.5" />
        <path d="M206 393 h196" stroke={INK} strokeOpacity=".15" strokeWidth="1.5" strokeDasharray="4 4" />
        {[232, 272, 312, 352].map((x) => (
          <g key={x}>
            <ellipse cx={x + 4} cy="375" rx="14" ry="9" fill={W} stroke={INK} strokeWidth="2" />
            <ellipse cx={x + 4} cy="412" rx="14" ry="9" fill={W} stroke={INK} strokeWidth="2" />
            <path d={`M${x - 3} 372 q7 -4 14 0`} stroke={INK} strokeOpacity=".25" strokeWidth="1.5" fill="none" />
          </g>
        ))}
      </g>

      {/* syrup bottle */}
      <g>
        <rect x="392" y="214" width="28" height="22" rx="4" fill={TD} stroke={INK} strokeWidth="2.5" />
        <path d="M384 248 q0 -12 14 -12 h16 q14 0 14 12 v116 q0 12 -12 12 h-20 q-12 0 -12 -12z" fill="var(--sj-amber)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="390" y="282" width="32" height="54" rx="4" fill={SL} stroke={INK} strokeWidth="2" />
        <path d="M398 298 h16 M398 308 h12" stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity=".5" />
        <path d="M394 254 v20" stroke={W} strokeWidth="3" strokeLinecap="round" opacity=".5" />
      </g>

      {/* cream tube */}
      <g transform="rotate(18 150 300)">
        <path d="M118 232 h64 l-6 116 h-52z" fill={W} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M116 226 h68 v8 h-68z" fill={INK} opacity=".85" />
        <path d="M121 268 h58 l-1.5 30 h-55z" fill={S} />
        <rect x="136" y="348" width="28" height="22" rx="3" fill={TD} stroke={INK} strokeWidth="2.5" />
        <path d="M130 312 h40 M132 324 h28" stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity=".35" />
        <path d="M118 228 l4 -6 m10 6 l4 -6 m10 6 l4 -6 m10 6 l4 -6 m10 6 l4 -6" stroke={INK} strokeWidth="1.5" opacity=".5" />
      </g>

      {/* capsule + tablet floating */}
      <g transform="rotate(-30 470 196)">
        <rect x="446" y="184" width="52" height="24" rx="12" fill={W} stroke={INK} strokeWidth="2.5" />
        <path d="M472 184 h14 a12 12 0 0 1 0 24 h-14z" fill={S} stroke={INK} strokeWidth="2.5" />
      </g>
      <g>
        <circle cx="128" cy="210" r="16" fill={W} stroke={INK} strokeWidth="2.5" />
        <path d="M116 210 h24" stroke={INK} strokeWidth="2" opacity=".4" />
      </g>
    </svg>
  );
}

/* ---------- Product pack art ---------- */
type Pack = "strip" | "bottle" | "tube";
export function PackArt({ kind, pill, band, shape = "round" }: { kind: Pack; pill?: string; band: string; shape?: "round" | "oval" | "caplet" }) {
  if (kind === "bottle") {
    return (
      <svg className="sj-pack-art" viewBox="0 0 240 150" aria-hidden="true" focusable="false">
        <ellipse cx="120" cy="138" rx="70" ry="6" fill={INK} opacity=".08" />
        <path d="M60 128 h64 v-74 l-12 -12 h-40 l-12 12z" fill={W} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <rect x="66" y="64" width="52" height="34" fill={band} />
        <path d="M72 108 h30 M72 116 h20" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".3" />
        <rect x="150" y="34" width="22" height="16" rx="3" fill={TD} stroke={INK} strokeWidth="2" />
        <path d="M142 62 q0 -12 12 -12 h14 q12 0 12 12 v60 q0 8 -8 8 h-22 q-8 0 -8 -8z" fill="var(--sj-amber)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <rect x="148" y="78" width="26" height="32" rx="3" fill={SL} stroke={INK} strokeWidth="1.5" />
        <path d="M154 88 h14 M154 96 h10" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".45" />
        <path d="M186 112 h20 l-3 16 h-14z" fill={W} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "tube") {
    return (
      <svg className="sj-pack-art" viewBox="0 0 240 150" aria-hidden="true" focusable="false">
        <ellipse cx="120" cy="138" rx="76" ry="6" fill={INK} opacity=".08" />
        <path d="M52 128 h66 v-80 h-66z" fill={W} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <rect x="58" y="60" width="54" height="30" fill={band} />
        <path d="M60 104 h34 M60 112 h22" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".3" />
        <g transform="rotate(-12 170 96)">
          <path d="M132 82 h70 v26 h-70z" fill={W} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M132 82 l-6 -2 v30 l6 -2" fill={INK} opacity=".8" />
          <path d="M202 86 h10 v18 h-10z" fill={TD} stroke={INK} strokeWidth="2" />
          <rect x="150" y="82" width="26" height="26" fill={band} opacity=".9" />
        </g>
      </svg>
    );
  }
  const pills = [0, 1, 2, 3, 4];
  const pillEl = (x: number, y: number) =>
    shape === "caplet" ? (
      <rect x={x - 11} y={y - 6} width="22" height="12" rx="6" fill={pill} stroke={INK} strokeWidth="1.5" />
    ) : shape === "oval" ? (
      <ellipse cx={x} cy={y} rx="10" ry="7" fill={pill} stroke={INK} strokeWidth="1.5" />
    ) : (
      <circle cx={x} cy={y} r="8" fill={pill} stroke={INK} strokeWidth="1.5" />
    );
  return (
    <svg className="sj-pack-art" viewBox="0 0 240 150" aria-hidden="true" focusable="false">
      <ellipse cx="120" cy="138" rx="90" ry="6" fill={INK} opacity=".08" />
      <path d="M40 128 v-76 l14 -14 h64 v90z" fill={W} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 52 h78" stroke={INK} strokeWidth="1.5" opacity=".3" />
      <rect x="46" y="62" width="66" height="24" fill={band} />
      <path d="M50 98 h40 M50 108 h26" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".3" />
      <g transform="rotate(-8 160 92)">
        <rect x="100" y="60" width="120" height="66" rx="6" fill="var(--sj-foil)" stroke={INK} strokeWidth="2" />
        {pills.map((i) => (
          <g key={i}>
            <rect x={108 + i * 22} y="66" width="18" height="24" rx="5" fill={W} stroke={INK} strokeOpacity=".2" />
            {pillEl(117 + i * 22, 78)}
            <rect x={108 + i * 22} y="96" width="18" height="24" rx="5" fill={W} stroke={INK} strokeOpacity=".2" />
            {pillEl(117 + i * 22, 108)}
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ---------- Therapy area icons (line) ---------- */
const icon = (children: React.ReactNode) => (
  <svg className="sj-ta-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{children}</g>
  </svg>
);
export const TherapyIcon: Record<string, React.ReactNode> = {
  Diabetes: icon(<>
    <path d="M24 6c6 9 12 15 12 22a12 12 0 0 1-24 0c0-7 6-13 12-22Z" />
    <path d="M18 30h4l2-5 3 9 2-4h3" stroke="var(--sj-saffron-deep)" />
  </>),
  Cardiac: icon(<>
    <path d="M24 40S8 30 8 18a8 8 0 0 1 16-3 8 8 0 0 1 16 3c0 12-16 22-16 22Z" />
    <path d="M12 24h7l3-5 4 9 3-4h7" stroke="var(--sj-saffron-deep)" />
  </>),
  Hypertension: icon(<>
    <path d="M8 32a16 16 0 1 1 32 0" />
    <path d="M24 32 32 20" stroke="var(--sj-saffron-deep)" />
    <circle cx="24" cy="32" r="2.5" />
    <path d="M12 22l2 1.5M24 16v2.5M36 22l-2 1.5M8 38h32" />
  </>),
  Gastro: icon(<>
    <path d="M20 6v8c0 4-8 4-8 14 0 8 6 14 14 14 9 0 14-6 14-12 0-8-7-10-11-8-3 2-5 1-5-3V6" />
    <path d="M20 30c2 2 6 2 8 0" stroke="var(--sj-saffron-deep)" />
  </>),
  Respiratory: icon(<>
    <path d="M24 6v16M24 18l-6 6M24 18l6 6" />
    <path d="M18 14c-6 0-10 10-10 20 0 4 2 6 5 6 5 0 7-4 7-10V20" />
    <path d="M30 14c6 0 10 10 10 20 0 4-2 6-5 6-5 0-7-4-7-10V20" />
    <path d="M12 30c2-1 4-1 5 0M31 30c1-1 3-1 5 0" stroke="var(--sj-saffron-deep)" />
  </>),
  Dermatology: icon(<>
    <path d="M6 18c6-3 12-3 18 0s12 3 18 0" />
    <path d="M6 26c6-3 12-3 18 0s12 3 18 0" stroke="var(--sj-saffron-deep)" />
    <path d="M6 34c6-3 12-3 18 0s12 3 18 0" />
    <path d="M16 8l2 4M30 8l-2 4" />
  </>),
};

/* ---------- Site line drawings (manufacturing units) ---------- */
export function SiteArt({ kind }: { kind: "solids" | "hills" | "port" | "lab" }) {
  const ground = <path d="M8 120 h264" stroke={INK} strokeWidth="2" strokeLinecap="round" />;
  return (
    <svg className="sj-site-art" viewBox="0 0 280 130" aria-hidden="true" focusable="false">
      <g fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        {kind === "hills" && <>
          <path d="M8 90 l50 -50 l30 26 l40 -46 l60 60 l34 -30 l50 40" stroke={T} strokeOpacity=".5" />
          <path d="M120 26 l8 -8 l8 8" stroke={W} />
        </>}
        {kind === "port" && <>
          <path d="M8 126 q12 -6 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0" stroke={T} />
          <path d="M214 104 h46 l-6 10 h-36z M224 104 v-14 h16 v14" stroke={T} />
        </>}
        {kind === "lab" ? <>
          <path d="M40 120 V56 h110 v64" fill={TL} />
          <path d="M150 120 V36 h80 v84" fill={W} />
          <path d="M56 72 h24 M96 72 h24 M56 94 h24 M96 94 h24" />
          <path d="M166 54 h48 M166 70 h48 M166 86 h48 M166 102 h48" opacity=".5" />
          <path d="M186 22 v-8 h8 v8 l8 14 h-24z" fill={S} />
          <circle cx="44" cy="40" r="8" fill={SL} />
          <path d="M44 32 v-6 M52 40 h6" />
        </> : <>
          <path d="M30 120 V64 l26 -18 v18 l26 -18 v18 l26 -18 v18 l26 -18 v74" fill={TL} />
          <path d="M134 120 V52 h96 v68" fill={W} />
          <path d="M150 70 h20 v14 h-20z M188 70 h26 v14 h-26z M150 96 h20 v24" />
          <path d="M44 84 h16 M72 84 h16 M100 84 h16 M44 100 h16 M72 100 h16 M100 100 h16" opacity=".55" />
          <path d="M206 52 V30 h12 v22" fill={kind === "solids" ? S : W} />
          <path d="M138 44 h88" stroke={T} strokeWidth="5" />
          <circle cx="196" cy="108" r="5" fill={S} />
        </>}
        {ground}
      </g>
    </svg>
  );
}

/* ---------- Small UI icons ---------- */
const ui = (d: React.ReactNode, cls = "sj-ui-icon") => (
  <svg className={cls} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</g>
  </svg>
);
export const Icon = {
  phone: ui(<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z" />),
  mail: ui(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  pin: ui(<><path d="M12 21s-7-6-7-12a7 7 0 0 1 14 0c0 6-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></>),
  shield: ui(<><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  alert: ui(<><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17.5v.01" /></>),
  box: ui(<><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5Z" /><path d="m3 7.5 9 4.5 9-4.5M12 12v9" /></>),
  clock: ui(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  check: ui(<path d="m5 12 4.5 4.5L19 7" />),
  cross: ui(<path d="M6 6l12 12M18 6 6 18" />),
  menu: ui(<path d="M4 7h16M4 12h16M4 17h16" />),
  info: ui(<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></>),
  cap: ui(<><path d="M2 9l10-5 10 5-10 5Z" /><path d="M6 11v5c3 2.5 9 2.5 12 0v-5" /></>),
  globe: ui(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>),
  arrow: ui(<path d="M5 12h14m-5-5 5 5-5 5" />),
};

export function Social({ name }: { name: "linkedin" | "x" | "youtube" | "instagram" }) {
  return (
    <svg className="sj-social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {name === "linkedin" && <g fill="currentColor"><rect x="3" y="9" width="4" height="12" rx="1" /><circle cx="5" cy="5" r="2.2" /><path d="M10 9h3.6v1.8c.6-1.1 2-2.1 4-2.1 3.2 0 4.4 2 4.4 5.3V21h-4v-6.2c0-1.6-.4-2.7-1.9-2.7S14 13.3 14 14.8V21h-4Z" /></g>}
      {name === "x" && <path d="M4 4h4.5l11.5 16h-4.5ZM19.5 4 4.5 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      {name === "youtube" && <g><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M10 9v6l5-3Z" fill="currentColor" /></g>}
      {name === "instagram" && <g fill="none" stroke="currentColor" strokeWidth="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".8" fill="currentColor" /></g>}
    </svg>
  );
}
