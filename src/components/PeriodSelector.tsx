// Segmented period selector for the Direction dashboard.
// Pure client-side filter applied to the monthly series already returned by
// the API — no extra network calls, no debounce required.

import { useMemo } from "react";

import type { ChartDatum } from "./Charts.js";

export type PeriodKey = "3m" | "6m" | "12m" | "ytd";

export interface PeriodOption {
  key: PeriodKey;
  label: string;
  months: number | "ytd";
}

export const PERIOD_OPTIONS: readonly PeriodOption[] = [
  { key: "3m", label: "3 mois", months: 3 },
  { key: "6m", label: "6 mois", months: 6 },
  { key: "12m", label: "12 mois", months: 12 },
  { key: "ytd", label: "Depuis janv.", months: "ytd" },
] as const;

interface PeriodSelectorProps {
  value: PeriodKey;
  onChange: (value: PeriodKey) => void;
  ariaLabel?: string;
}

export function PeriodSelector({ value, onChange, ariaLabel }: PeriodSelectorProps): JSX.Element {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel ?? "Sélection de la période"}>
      {PERIOD_OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            className={`segmented-btn${active ? " is-active" : ""}`}
            aria-pressed={active}
            onClick={() => onChange(opt.key)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Filter a monthly series ("YYYY-MM" formatted) to the selected period.
 * Assumes the series is sorted chronologically ascending, which matches the
 * `entrees_mensuelles` payload from the Direction API.
 */
export function usePeriodFilter(
  rows: { mois: string; total: number }[] | undefined,
  period: PeriodKey,
): { mois: string; total: number }[] {
  return useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const option = PERIOD_OPTIONS.find((o) => o.key === period);
    if (!option) return rows;
    if (option.months === "ytd") {
      const year = new Date().getFullYear().toString();
      return rows.filter((r) => r.mois.startsWith(year));
    }
    return rows.slice(-option.months);
  }, [rows, period]);
}

/**
 * Sum a series and compare it to the previous window of the same size. Returns
 * null when there is not enough history to make an honest comparison.
 */
export function computeTrend(
  rows: { mois: string; total: number }[] | undefined,
  windowMonths: number,
): { current: number; previous: number; deltaPct: number | null } | null {
  if (!rows || rows.length < windowMonths) return null;
  const current = rows.slice(-windowMonths).reduce((a, r) => a + r.total, 0);
  const previousSlice = rows.slice(-windowMonths * 2, -windowMonths);
  if (previousSlice.length < windowMonths) return { current, previous: 0, deltaPct: null };
  const previous = previousSlice.reduce((a, r) => a + r.total, 0);
  const deltaPct = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  return { current, previous, deltaPct };
}

interface SparklineProps {
  points: ChartDatum[];
  width?: number;
  height?: number;
  color?: string;
}

/** Compact SVG sparkline — no axes, meant to sit inside a KPI card. */
export function Sparkline({ points, width = 96, height = 28, color = "currentColor" }: SparklineProps): JSX.Element | null {
  if (points.length < 2) return null;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = width / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(stepX * i).toFixed(2)} ${(height - (p.value / max) * height).toFixed(2)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
