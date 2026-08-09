// Shared UI states for the ADSUM Direction dashboard.
// Every screen must handle loading, empty, error and access-denied with the
// same care as the nominal state. These primitives keep that contract cheap
// to apply and free of hardcoded colours (all tokens come from styles.css).

import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="state state-empty" role="status">
      <span className="state-dot" aria-hidden="true" />
      <p className="state-title">{title}</p>
      {description && <p className="state-desc">{description}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps): JSX.Element {
  return (
    <div className="state state-error" role="alert">
      <p className="state-title">{title ?? "Impossible d'afficher ces données"}</p>
      {message && <p className="state-desc">{message}</p>}
      {onRetry && (
        <div className="state-action">
          <button type="button" className="btn btn-ghost btn-inline" onClick={onRetry}>
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}

export function SkeletonBlock({ height = 16, width = "100%" }: { height?: number | string; width?: number | string }): JSX.Element {
  return <span className="skeleton" style={{ height, width }} aria-hidden="true" />;
}

export function SkeletonKpi(): JSX.Element {
  return (
    <div className="kpi" aria-hidden="true">
      <SkeletonBlock height={10} width="45%" />
      <SkeletonBlock height={28} width="60%" />
      <SkeletonBlock height={10} width="70%" />
    </div>
  );
}

export function SkeletonChart({ height = 200 }: { height?: number }): JSX.Element {
  return <div className="skeleton skeleton-chart" style={{ height }} aria-hidden="true" />;
}
