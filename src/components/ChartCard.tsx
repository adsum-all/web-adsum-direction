// Uniform section wrapper for every chart. Provides a title, an optional
// explanatory InfoTip and a right-side hint slot.

import type { ReactNode } from "react";

import { InfoTip, type InfoTipContent } from "./InfoTip.js";

export function ChartCard({
  title,
  hint,
  info,
  children,
  toolbar,
  as = "section",
  ariaLabelledById,
}: {
  title: string;
  hint?: ReactNode;
  info?: InfoTipContent;
  children: ReactNode;
  toolbar?: ReactNode;
  as?: "section" | "div";
  ariaLabelledById?: string;
}): JSX.Element {
  const H = as;
  const headingId = ariaLabelledById ?? `chart-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <H className="card" aria-labelledby={headingId}>
      <div className="section-head">
        <div className="section-title-row">
          <h2 id={headingId}>{title}</h2>
          {info && <InfoTip label={`Explication : ${title}`} content={info} />}
        </div>
        <div className="section-head-right">
          {toolbar}
          {hint && <span className="hint">{hint}</span>}
        </div>
      </div>
      {children}
    </H>
  );
}
