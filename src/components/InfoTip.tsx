// Accessible info popover attached to KPIs and charts.
// Explains what the indicator measures, its formula, the population, and any
// limits. Opens on click/Enter, closes on Escape or outside click.

import { useEffect, useId, useRef, useState } from "react";

export interface InfoTipContent {
  measure: string;
  formula?: string;
  period?: string;
  population?: string;
  exclusions?: string;
  limits?: string;
}

export function InfoTip({ label, content }: { label?: string; content: InfoTipContent }): JSX.Element {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    const onClick = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onClick); };
  }, [open]);

  return (
    <span className="infotip">
      <button
        ref={btnRef}
        type="button"
        className="infotip-btn"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label ?? "Explication de l'indicateur"}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {open && (
        <div ref={popRef} id={id} role="dialog" className="infotip-pop">
          <p className="infotip-measure">{content.measure}</p>
          {content.formula && <p><b>Formule :</b> {content.formula}</p>}
          {content.period && <p><b>Période :</b> {content.period}</p>}
          {content.population && <p><b>Population :</b> {content.population}</p>}
          {content.exclusions && <p><b>Exclusions :</b> {content.exclusions}</p>}
          {content.limits && <p className="infotip-limit"><b>Limites :</b> {content.limits}</p>}
        </div>
      )}
    </span>
  );
}
