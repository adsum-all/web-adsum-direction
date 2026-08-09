// Répartition détaillée de participation par entité (commission, tribu,
// coordination, intendance, pays, continent, volet). Affiche pour chaque
// ligne : effectif pointé, présents, partiels, absents, taux d'assiduité et
// taux de mobilisation, plus une barre empilée pour comparaison visuelle.
// Tri client-side, pagination par lots.

import { useMemo, useState } from "react";

import type { BreakdownDimension, EntityBreakdownRow } from "../api.js";
import { StackedBar } from "./Charts.js";
import { EmptyState } from "./States.js";
import { Paginator, usePagination } from "./Paginator.js";

export const DIMENSION_LABEL: Record<BreakdownDimension, string> = {
  commission: "Commission",
  tribu: "Tribu",
  coordination: "Coordination",
  intendance: "Intendance",
  pays: "Pays",
  continent: "Continent",
  volet: "Volet",
};

type SortKey = "label" | "total" | "assiduite" | "mobilisation" | "presents" | "absents";

function rate(present: number, partiel: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round(((present + 0.5 * partiel) / total) * 100);
}
function attendance(present: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((present / total) * 100);
}

export function EntityBreakdown({
  rows,
  dimensionLabel,
  emptyTitle = "Aucune donnée par entité disponible",
  emptyDescription,
}: {
  rows: EntityBreakdownRow[];
  dimensionLabel: string;
  emptyTitle?: string;
  emptyDescription?: string;
}): JSX.Element {
  const [sort, setSort] = useState<SortKey>("mobilisation");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const enriched = useMemo(() => rows.map((r) => {
    const total = r.presents + r.partiels + r.absents;
    return {
      ...r,
      total,
      assiduite: attendance(r.presents, total),
      mobilisation: rate(r.presents, r.partiels, total),
    };
  }), [rows]);

  const sorted = useMemo(() => {
    const arr = [...enriched];
    arr.sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      if (typeof av === "string" && typeof bv === "string") {
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const na = typeof av === "number" ? av : -Infinity;
      const nb = typeof bv === "number" ? bv : -Infinity;
      return dir === "asc" ? na - nb : nb - na;
    });
    return arr;
  }, [enriched, sort, dir]);

  const pager = usePagination(sorted, 10);

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const maxTotal = Math.max(1, ...enriched.map((r) => r.total));

  const setSortKey = (k: SortKey) => {
    if (k === sort) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(k); setDir(k === "label" ? "asc" : "desc"); }
  };
  const th = (k: SortKey, label: string) => (
    <th>
      <button type="button" className="th-sort" onClick={() => setSortKey(k)} aria-sort={sort === k ? (dir === "asc" ? "ascending" : "descending") : "none"}>
        {label}{sort === k ? (dir === "asc" ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );

  return (
    <>
      <div className="table-scroll">
        <table className="data-table breakdown-table">
          <thead>
            <tr>
              {th("label", dimensionLabel)}
              {th("total", "Pointages")}
              {th("presents", "Sur place")}
              <th>À distance</th>
              {th("absents", "Absents")}
              {th("assiduite", "Assiduité")}
              {th("mobilisation", "Mobilisation")}
              <th>Répartition</th>
            </tr>
          </thead>
          <tbody>
            {pager.slice.map((r) => (
              <tr key={r.label}>
                <td>
                  <span className="breakdown-label">{r.label}</span>
                  <span className="breakdown-share muted small"> · {Math.round((r.total / maxTotal) * 100)}% du plus grand</span>
                </td>
                <td>{r.total.toLocaleString("fr-FR")}</td>
                <td className="num-presents">{r.presents.toLocaleString("fr-FR")}</td>
                <td className="num-partiels">{r.partiels.toLocaleString("fr-FR")}</td>
                <td className="num-absents">{r.absents.toLocaleString("fr-FR")}</td>
                <td><RateBadge value={r.assiduite} kind="assiduite" /></td>
                <td><RateBadge value={r.mobilisation} kind="mobilisation" /></td>
                <td className="col-bar">
                  <StackedBar presents={r.presents} partiels={r.partiels} absents={r.absents} height={12} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginator
        page={pager.page}
        totalPages={pager.totalPages}
        from={pager.from}
        to={pager.to}
        total={pager.total}
        pageSize={pager.pageSize}
        onPageSizeChange={pager.setPageSize}
        onPrev={pager.prev}
        onNext={pager.next}
        canPrev={pager.canPrev}
        canNext={pager.canNext}
        label="Pagination de la répartition"
      />
    </>
  );
}

function RateBadge({ value, kind }: { value: number | null; kind: "assiduite" | "mobilisation" }): JSX.Element {
  if (value === null) return <span className="rate-badge rate-na">-</span>;
  const tone = value >= 75 ? "rate-good" : value >= 50 ? "rate-mid" : "rate-low";
  return (
    <span className={`rate-badge ${tone}`} title={kind === "assiduite" ? "Venus sur place / occasions attendues" : "Ont suivi / occasions attendues"}>
      {value}%
    </span>
  );
}
