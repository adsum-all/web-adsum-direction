// Reusable KPI tile with trend badge, unit, hint and optional sparkline.

import type { ChartDatum } from "./Charts.js";
import { Sparkline } from "./PeriodSelector.js";
import { InfoTip, type InfoTipContent } from "./InfoTip.js";

export interface KpiProps {
  label: string;
  value: number | string | undefined | null;
  hint?: string;
  accent?: boolean;
  suffix?: string;
  trend?: number | null;
  trendComparisonLabel?: string;
  sparkline?: ChartDatum[];
  info?: InfoTipContent;
}

export function Kpi({
  label, value, hint, accent, suffix, trend, trendComparisonLabel, sparkline, info,
}: KpiProps): JSX.Element {
  const displayValue = value === undefined || value === null
    ? "-"
    : typeof value === "number"
      ? `${value.toLocaleString("fr-FR")}${suffix ?? ""}`
      : value;
  const trendClass = trend === null || trend === undefined
    ? null
    : trend > 0 ? "kpi-trend-up" : trend < 0 ? "kpi-trend-down" : "kpi-trend-flat";
  const trendLabel = trend === null || trend === undefined
    ? null
    : `${trend > 0 ? "+" : ""}${trend}%`;
  return (
    <div className={`kpi ${accent ? "kpi-accent" : ""}`}>
      <div className="kpi-head">
        <span className="kpi-label">{label}</span>
        {info && <InfoTip label={`Explication : ${label}`} content={info} />}
      </div>
      <div className="kpi-row">
        <span className="kpi-value">{displayValue}</span>
        {trendClass && (
          <span className={`kpi-trend ${trendClass}`} title={trendComparisonLabel}>
            {trendLabel}
          </span>
        )}
      </div>
      {hint && <span className="kpi-hint">{hint}</span>}
      {sparkline && sparkline.length > 1 && (
        <span className="kpi-sparkline"><Sparkline points={sparkline} /></span>
      )}
    </div>
  );
}
