// Lightweight, dependency-free SVG charts for the ADSUM back-office.
// Colours follow the design system tokens (see src/tokens.css). Every chart is
// rendered from real data passed by the caller - no synthetic series.
//
// Every chart accepts optional `unit`, `legend`, and empty-state props so the
// caller can describe what the axis represents without hardcoding it inside
// the component. Tooltips are backed by native <title> for accessibility and
// hover discovery.

import { useId, useMemo } from "react";

export const CHART_PALETTE = [
  "#2a4fad",
  "#5b82d8",
  "#1f8a5b",
  "#b5731a",
  "#8aa8e6",
  "#c0392b",
  "#5b6480",
  "#223f8a",
];

const BRAND = "#2a4fad";
const BRAND_LIGHT = "#5b82d8";

export interface ChartDatum {
  label: string;
  value: number;
}

function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR");
}

function withUnit(value: number, unit?: string): string {
  return unit ? `${formatNumber(value)} ${unit}` : formatNumber(value);
}

/** Round a raw step up to a readable value: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const power = Math.floor(Math.log10(rough));
  const base = Math.pow(10, power);
  const unit = rough / base;
  let mult = 10;
  if (unit <= 1) mult = 1;
  else if (unit <= 2) mult = 2;
  else if (unit <= 2.5) mult = 2.5;
  else if (unit <= 5) mult = 5;
  const step = mult * base;
  return step < 1 ? 1 : step;
}

function buildScale(rawMax: number, divisions = 4): { max: number; ticks: number[] } {
  const step = niceStep(Math.max(rawMax, 1) / divisions);
  const max = Math.max(step, Math.ceil(Math.max(rawMax, 1) / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { max, ticks };
}

function ChartEmpty({ message }: { message: string }): JSX.Element {
  return (
    <div className="chart-empty" role="status">
      <span className="chart-empty-dot" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

interface DonutProps {
  segments: ChartDatum[];
  centerLabel?: string;
  size?: number;
  unit?: string;
  emptyMessage?: string;
}

/**
 * Donut chart with a centred total and an aligned legend (value + share).
 * When the number of segments exceeds 6 we degrade gracefully to a horizontal
 * bar chart, which stays readable where a donut would turn into confetti.
 */
export function DonutChart({ segments, centerLabel, size = 168, unit, emptyMessage }: DonutProps): JSX.Element {
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const radius = size / 2;
  const stroke = size * 0.16;
  const inner = radius - stroke / 2;
  const circumference = 2 * Math.PI * inner;
  let offset = 0;

  if (total === 0) {
    return <ChartEmpty message={emptyMessage ?? "Aucune donnée à afficher pour le moment."} />;
  }

  if (segments.length > 6) {
    const sorted = [...segments].sort((a, b) => b.value - a.value);
    return <BarChart items={sorted} unit={unit} orientation="horizontal" />;
  }

  return (
    <div className="donut-wrap">
      <svg
        className="chart-svg donut"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Répartition : ${segments.map((s) => `${s.label} ${withUnit(s.value, unit)}`).join(", ")}`}
      >
        <g transform={`rotate(-90 ${radius} ${radius})`}>
          <circle cx={radius} cy={radius} r={inner} fill="none" className="donut-track" strokeWidth={stroke} />
          {segments.map((s, i) => {
            const fraction = s.value / total;
            const dash = fraction * circumference;
            const seg = (
              <circle
                key={s.label}
                cx={radius}
                cy={radius}
                r={inner}
                fill="none"
                stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              >
                <title>{`${s.label} : ${withUnit(s.value, unit)} (${Math.round((100 * s.value) / total)}%)`}</title>
              </circle>
            );
            offset += dash;
            return seg;
          })}
        </g>
        <text x={radius} y={radius - 4} textAnchor="middle" className="donut-total">
          {formatNumber(total)}
        </text>
        <text x={radius} y={radius + 16} textAnchor="middle" className="donut-sub">
          {centerLabel ?? "total"}
        </text>
      </svg>
      <ul className="legend-list">
        {segments.map((s, i) => (
          <li key={s.label}>
            <i style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }} />
            <span>{s.label}</span>
            <b>{formatNumber(s.value)}</b>
            <em className="legend-pct">{Math.round((100 * s.value) / total)}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface BarProps {
  items: ChartDatum[];
  height?: number;
  emptyMessage?: string;
  unit?: string;
  /** Vertical (default) or horizontal bars. Horizontal handles long labels better. */
  orientation?: "vertical" | "horizontal";
  /** When more categories than this exist, group the tail into "Autres". */
  topN?: number;
  /** For vertical charts: rotate category labels by 35° for readability. */
  rotateLabels?: boolean;
}


/**
 * Bar chart with a readable Y axis, tooltip on each bar and safe truncation.
 * Falls back to a horizontal layout when the caller asks for it (used for
 * long category labels or by the donut fallback path).
 */
export function BarChart({
  items,
  height = 240,
  emptyMessage,
  unit,
  orientation = "vertical",
  topN = 8,
  rotateLabels = false,
}: BarProps): JSX.Element {

  const gradId = `bar-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const grouped = useMemo(() => {
    if (items.length <= topN) return items;
    const sorted = [...items].sort((a, b) => b.value - a.value);
    const head = sorted.slice(0, topN - 1);
    const tail = sorted.slice(topN - 1);
    const rest = tail.reduce((acc, r) => acc + r.value, 0);
    return rest > 0 ? [...head, { label: "Autres", value: rest }] : head;
  }, [items, topN]);

  if (grouped.length === 0) {
    return <ChartEmpty message={emptyMessage ?? "Aucune donnée à afficher pour le moment."} />;
  }

  if (orientation === "horizontal") {
    const rawMax = Math.max(0, ...grouped.map((i) => i.value));
    const { max } = buildScale(rawMax);
    return (
      <div className="bars" role="list">
        {grouped.map((it) => {
          const pct = (it.value / max) * 100;
          return (
            <div className="bar-row" key={it.label} role="listitem">
              <span className="bar-label" title={it.label}>{it.label}</span>
              <div className="bar-track" aria-label={`${it.label} : ${withUnit(it.value, unit)}`}>
                <div
                  className="bar-fill"
                  style={{ width: `${Math.max(pct, it.value > 0 ? 1.5 : 0)}%` }}
                />
              </div>
              <span className="bar-value">{formatNumber(it.value)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  const rawMax = Math.max(0, ...grouped.map((i) => i.value));
  const { max, ticks } = buildScale(rawMax);
  const width = Math.max(grouped.length * 64, 380);
  const padLeft = 46;
  const padRight = 14;
  const padTop = 20;
  const padBottom = rotateLabels ? 60 : 34;
  const plot = height - padBottom - padTop;
  const slot = (width - padLeft - padRight) / grouped.length;
  const barW = Math.min(40, slot * 0.55);


  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Histogramme : ${grouped.map((i) => `${i.label} ${withUnit(i.value, unit)}`).join(", ")}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BRAND_LIGHT} />
          <stop offset="100%" stopColor={BRAND} />
        </linearGradient>
      </defs>
      {ticks.map((t) => {
        const y = padTop + plot * (1 - t / max);
        return (
          <g key={t}>
            <line x1={padLeft} x2={width - padRight} y1={y} y2={y} className="grid-line" />
            <text x={padLeft - 8} y={y + 3.5} textAnchor="end" className="axis-num">
              {formatNumber(t)}
            </text>
          </g>
        );
      })}
      {unit && (
        <text x={padLeft - 8} y={padTop - 6} textAnchor="end" className="axis-unit">
          {unit}
        </text>
      )}
      {grouped.map((it, i) => {
        const h = (it.value / max) * plot;
        const x = padLeft + slot * i + (slot - barW) / 2;
        const y = padTop + plot - h;
        const short = rotateLabels
          ? (it.label.length > 22 ? `${it.label.slice(0, 21)}…` : it.label)
          : (it.label.length > 10 ? `${it.label.slice(0, 9)}.` : it.label);
        const cx = x + barW / 2;
        const labelY = rotateLabels ? height - 8 : height - 12;
        return (
          <g key={`${it.label}-${i}`} tabIndex={0} className="chart-focusable">
            <title>{`${it.label} : ${withUnit(it.value, unit)}`}</title>
            <rect x={x} y={y} width={barW} height={Math.max(h, it.value > 0 ? 2 : 0)} rx={4} fill={`url(#${gradId})`} />
            <text x={cx} y={y - 6} textAnchor="middle" className="bar-num">
              {formatNumber(it.value)}
            </text>
            <text
              x={cx}
              y={labelY}
              textAnchor={rotateLabels ? "end" : "middle"}
              className="bar-cat"
              transform={rotateLabels ? `rotate(-35 ${cx} ${labelY})` : undefined}
            >
              {short}
            </text>
          </g>
        );

      })}
    </svg>
  );
}

interface LineProps {
  points: ChartDatum[];
  height?: number;
  emptyMessage?: string;
  unit?: string;
}

/**
 * Area line chart for a time series. The Y scale is rounded to a readable
 * maximum (never below 1, so an all-zero year is not squashed), grid lines
 * carry their values and every point shows its value.
 */
export function LineChart({ points, height = 240, emptyMessage, unit }: LineProps): JSX.Element {
  const gradId = `line-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (points.length === 0) {
    return <ChartEmpty message={emptyMessage ?? "Aucune donnée sur la période."} />;
  }
  const rawMax = Math.max(0, ...points.map((p) => p.value));
  const { max, ticks } = buildScale(rawMax);
  const width = Math.max(points.length * 56, 460);
  const padLeft = 46;
  const padRight = 18;
  const padTop = 24;
  const padBottom = 30;
  const plot = height - padTop - padBottom;
  const innerW = width - padLeft - padRight;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: padLeft + (points.length > 1 ? stepX * i : innerW / 2),
    y: padTop + plot * (1 - p.value / max),
    ...p,
  }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const baseline = padTop + plot;
  const areaPath = `${linePath} L ${coords[coords.length - 1]?.x ?? padLeft} ${baseline} L ${
    coords[0]?.x ?? padLeft
  } ${baseline} Z`;
  const showValues = points.length <= 16;
  const labelEvery = points.length > 16 ? 2 : 1;

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Courbe : ${points.map((p) => `${p.label} ${withUnit(p.value, unit)}`).join(", ")}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BRAND_LIGHT} stopOpacity={0.26} />
          <stop offset="100%" stopColor={BRAND_LIGHT} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {ticks.map((t) => {
        const y = padTop + plot * (1 - t / max);
        return (
          <g key={t}>
            <line x1={padLeft} x2={width - padRight} y1={y} y2={y} className="grid-line" />
            <text x={padLeft - 8} y={y + 3.5} textAnchor="end" className="axis-num">
              {formatNumber(t)}
            </text>
          </g>
        );
      })}
      {unit && (
        <text x={padLeft - 8} y={padTop - 6} textAnchor="end" className="axis-unit">
          {unit}
        </text>
      )}
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={BRAND} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => (
        <g key={`${c.label}-${i}`} tabIndex={0} className="chart-focusable">
          <title>{`${c.label} : ${withUnit(c.value, unit)}`}</title>
          <circle cx={c.x} cy={c.y} r={3.5} fill="#fff" stroke={BRAND} strokeWidth={2} />
          {showValues && (
            <text x={c.x} y={c.y - 10} textAnchor="middle" className="point-num">
              {formatNumber(c.value)}
            </text>
          )}
          {i % labelEvery === 0 && (
            <text x={c.x} y={height - 8} textAnchor="middle" className="bar-cat">
              {c.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Stacked presence bar (present / partial / absent), shared by dashboards. */
export function StackedBar({ presents, partiels, absents, height = 10 }: {
  presents: number;
  partiels: number;
  absents: number;
  height?: number;
}): JSX.Element {
  const total = Math.max(1, presents + partiels + absents);
  const seg = (n: number, color: string, label: string) =>
    n > 0 ? (
      <div
        key={label}
        title={`${label} : ${formatNumber(n)} (${Math.round((100 * n) / total)}%)`}
        style={{ width: `${(100 * n) / total}%`, background: color }}
      />
    ) : null;
  return (
    <div
      className="stacked-bar"
      role="img"
      aria-label={`Présents ${presents}, partiels ${partiels}, absents ${absents}`}
      style={{ display: "flex", height, borderRadius: 6, overflow: "hidden", background: "var(--adsum-line)" }}
    >
      {seg(presents, "var(--adsum-ok)", "Présents")}
      {seg(partiels, "var(--adsum-warn)", "Partiels")}
      {seg(absents, "var(--adsum-danger)", "Absents")}
    </div>
  );
}

export function PresenceLegend(): JSX.Element {
  return (
    <div className="legend" aria-hidden="true">
      <span><i style={{ background: "var(--adsum-ok)" }} /> Présents</span>
      <span><i style={{ background: "var(--adsum-warn)" }} /> Partiels</span>
      <span><i style={{ background: "var(--adsum-danger)" }} /> Absents</span>
    </div>
  );
}
