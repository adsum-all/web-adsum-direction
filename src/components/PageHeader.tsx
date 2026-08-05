// Page sub-header. The page title lives in the top bar (see App shell), so this
// component intentionally does NOT repeat it: it only renders the contextual
// description and page-level actions to avoid duplicated information.
import type { ReactNode } from "react";

export function PageHeader({
  description,
  actions,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
}): JSX.Element | null {
  if (!description && !actions) return null;
  return (
    <header className="page-head page-head-slim">
      {description && <p className="page-lede">{description}</p>}
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function RefreshBar({
  onReload,
  isRefreshing,
  lastUpdate,
  extra,
}: {
  onReload: () => void;
  isRefreshing: boolean;
  lastUpdate: Date | null;
  extra?: ReactNode;
}): JSX.Element {
  return (
    <div className="dashboard-toolbar" role="region" aria-label="Actualisation">
      {extra}
      <span className="spacer" aria-hidden="true" />
      <button
        type="button"
        className={`refresh-btn${isRefreshing ? " is-loading" : ""}`}
        onClick={onReload}
        disabled={isRefreshing}
        aria-live="polite"
      >
        <span className="dot" aria-hidden="true" />
        {isRefreshing ? "Actualisation…" : lastUpdate ? `Actualisé ${lastUpdate.toLocaleTimeString("fr-FR")}` : "Actualiser"}
      </button>
    </div>
  );
}
