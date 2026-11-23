"use client";

// Charts: the shadcn/ui "chart" pattern (ChartContainer + ChartTooltip around Recharts), copied by hand and
// fitted to our tokens. Series colours are CSS variables (components/ui/chart.css, light + dark, validated with
// the dataviz palette checker), so a chart never holds a raw hex. Differences from shadcn:
// - each series colour is exposed as `--chart-<key>` (not `--color-<key>`, which would clash with Tailwind tokens);
// - the legend is plain HTML from the config (it sits in the card header, not inside the SVG);
// - animation is off when the reader prefers reduced motion (`useReducedMotion`).

import { createContext, useContext, useId, useSyncExternalStore } from "react";
import * as Recharts from "recharts";
import "./chart.css";

export type ChartConfig = Record<string, {
  label: string;
  /** A CSS colour, normally a series variable: `var(--series-1)`. */
  color?: string;
  /** Or one colour per theme. */
  theme?: { light: string; dark: string };
}>;

const ChartContext = createContext<ChartConfig | null>(null);

export function useChart(): ChartConfig {
  const c = useContext(ChartContext);
  if (!c) throw new Error("useChart must be used inside <ChartContainer>");
  return c;
}

/** Sizes the chart to its box (give it a height), sets `--chart-<key>` colours, labels the figure. */
export function ChartContainer({ config, label, description, className = "", children, ...props }: {
  config: ChartConfig;
  /** Accessible name of the chart (the figure). */
  label: string;
  /** A one-sentence summary of what the chart shows, read by screen readers. */
  description?: string;
  className?: string;
  children: React.ReactElement;
} & Omit<React.ComponentProps<"div">, "children">) {
  const raw = useId();
  const id = `chart-${raw.replace(/[^a-zA-Z0-9-]/g, "")}`;
  return (
    <ChartContext.Provider value={config}>
      <div data-slot="chart" data-chart={id} role="figure" aria-label={label} aria-describedby={description ? `${id}-d` : undefined}
        className={`chart-box ${className}`} {...props}>
        <ChartStyle id={id} config={config} />
        {description && <p id={`${id}-d`} className="sr-only">{description}</p>}
        <Recharts.ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 200 }}>
          {children}
        </Recharts.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const entries = Object.entries(config);
  const vars = (mode: "light" | "dark") =>
    entries.map(([k, v]) => { const c = v.theme?.[mode] ?? v.color; return c ? `--chart-${k}: ${c};` : ""; }).join(" ");
  const sel = `[data-chart="${id}"]`;
  const hasTheme = entries.some(([, v]) => v.theme);
  const css = `${sel} { ${vars("light")} }` + (hasTheme
    ? `\n@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) ${sel} { ${vars("dark")} } }\n:root[data-theme="dark"] ${sel} { ${vars("dark")} }`
    : "");
  // Keys and colours come from code, never from data.
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

/** Recharts' Tooltip; pass `content={<ChartTooltipContent … />}`. */
export const ChartTooltip = Recharts.Tooltip;

type Row = { dataKey?: unknown; name?: unknown; value?: unknown; payload?: unknown };

/** Tooltip card: a heading (the x value), then one row per series: line key, value (strong), name. */
export function ChartTooltipContent({ active, payload, label, labelFormatter, valueFormatter = (v) => String(v), footer, hideZero = false }: {
  active?: boolean;
  payload?: ReadonlyArray<Row>;
  label?: React.ReactNode;
  labelFormatter?: (label: React.ReactNode, row: unknown) => React.ReactNode;
  valueFormatter?: (v: number) => string;
  /** Extra line under the rows (e.g. a total), from the hovered datum. */
  footer?: (row: unknown) => React.ReactNode;
  hideZero?: boolean;
}) {
  const config = useContext(ChartContext) ?? {};
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload;
  // Reverse so the order matches a stack read top-down.
  const rows = [...payload].reverse().filter((p) => !hideZero || Number(p.value) !== 0);
  return (
    <div className="chart-tip">
      {label != null && <p className="chart-tip-head">{labelFormatter ? labelFormatter(label, datum) : label}</p>}
      <ul>
        {rows.map((p) => {
          const key = String(p.dataKey ?? p.name);
          return (
            <li key={key}>
              <i style={{ background: `var(--chart-${key})` }} aria-hidden="true" />
              <strong>{valueFormatter(Number(p.value ?? 0))}</strong>
              <span>{config[key]?.label ?? String(p.name ?? key)}</span>
            </li>
          );
        })}
      </ul>
      {footer && <p className="chart-tip-foot">{footer(datum)}</p>}
    </div>
  );
}

/** Legend from the config: a swatch (rect for bars/areas) + name in text ink. */
export function ChartLegend({ config, keys, className = "" }: { config: ChartConfig; keys?: string[]; className?: string }) {
  return (
    <ul className={`chart-legend ${className}`}>
      {(keys ?? Object.keys(config)).map((k) => (
        <li key={k}><i style={{ background: config[k].theme ? `var(--chart-${k})` : config[k].color }} aria-hidden="true" />{config[k].label}</li>
      ))}
    </ul>
  );
}

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void) {
  const m = window.matchMedia(motionQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
/** True when the reader asked for less motion (charts then draw without animation). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(motionQuery).matches, () => true);
}
