// Chunked pagination helper with a selectable page size (5 / 10 / 20 / 50).
// The Paginator UI matches the "1-4 sur 31 (lot 1/8)  [Precedent] [Suivant]"
// pattern requested by the direction team.

import { useEffect, useMemo, useState } from "react";

const DEFAULT_SIZES = [5, 10, 20, 50] as const;

export function usePagination<T>(items: T[], initialPageSize = 10) {
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const slice = useMemo(
    () => items.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [items, safePage, pageSize],
  );
  // Reset to first page when the page size changes so the range stays sensible.
  useEffect(() => {
    setPage(0);
  }, [pageSize]);
  const from = items.length === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(items.length, safePage * pageSize + pageSize);
  return {
    page: safePage,
    totalPages,
    total: items.length,
    from,
    to,
    pageSize,
    setPageSize,
    slice,
    canPrev: safePage > 0,
    canNext: safePage < totalPages - 1,
    prev: () => setPage((p) => Math.max(0, p - 1)),
    next: () => setPage((p) => Math.min(totalPages - 1, p + 1)),
    reset: () => setPage(0),
  };
}

export function Paginator({
  page,
  totalPages,
  from,
  to,
  total,
  pageSize,
  onPageSizeChange,
  pageSizes = [...DEFAULT_SIZES],
  onPrev,
  onNext,
  canPrev,
  canNext,
  label,
}: {
  page: number;
  totalPages: number;
  from?: number;
  to?: number;
  total?: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizes?: number[];
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  label?: string;
}): JSX.Element {
  const showRange = from !== undefined && to !== undefined && total !== undefined;
  const showSizes = pageSize !== undefined && onPageSizeChange !== undefined;
  return (
    <nav className="paginator" aria-label={label ?? "Pagination"}>
      {showSizes && (
        <label className="pager-size">
          <span className="pager-size-label">Afficher</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange!(Number(e.target.value))}
            aria-label="Éléments par page"
          >
            {pageSizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      <span className="pager-count" aria-live="polite">
        {showRange
          ? `${from}-${to} sur ${total} (lot ${page + 1}/${totalPages})`
          : `Page ${page + 1} / ${totalPages}`}
      </span>
      <div className="pager-actions">
        <button type="button" className="pager-btn" onClick={onPrev} disabled={!canPrev} aria-label="Précédent">
          ‹ Précédent
        </button>
        <button type="button" className="pager-btn" onClick={onNext} disabled={!canNext} aria-label="Suivant">
          Suivant ›
        </button>
      </div>
    </nav>
  );
}
