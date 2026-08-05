// Sélecteur segmenté pour choisir une dimension d'analyse.
import type { BreakdownDimension } from "../api.js";
import { DIMENSION_LABEL } from "./EntityBreakdown.js";

export function DimensionPicker({
  value, onChange, dimensions, id, ariaLabel,
}: {
  value: BreakdownDimension;
  onChange: (d: BreakdownDimension) => void;
  dimensions: readonly BreakdownDimension[];
  id?: string;
  ariaLabel?: string;
}): JSX.Element {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel ?? "Dimension d'analyse"} id={id}>
      {dimensions.map((d) => (
        <button
          key={d}
          type="button"
          className={`segmented-btn${value === d ? " is-active" : ""}`}
          aria-pressed={value === d}
          onClick={() => onChange(d)}
        >
          {DIMENSION_LABEL[d]}
        </button>
      ))}
    </div>
  );
}
