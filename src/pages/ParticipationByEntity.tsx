// Onglet réutilisable : répartition de participation par entité (dimension
// sélectionnable) + possibilité de croisement avec une seconde dimension.
// S'appuie sur /admin/participation/par-entite. Si l'endpoint n'existe pas,
// on affiche un PendingDataState clair au lieu de fabriquer des chiffres.

import { useMemo, useState } from "react";

import { getParticipationParEntite, type BreakdownDimension, type EntityBreakdownRow } from "../api.js";
import { ChartCard } from "../components/ChartCard.js";
import { DimensionPicker } from "../components/DimensionPicker.js";
import { EntityBreakdown, DIMENSION_LABEL } from "../components/EntityBreakdown.js";
import { PendingDataState } from "../components/PendingDataState.js";
import { ErrorState, SkeletonChart } from "../components/States.js";
import { useDirection } from "../DirectionContext.js";
import { useResource } from "../useResource.js";

const DIMENSIONS: readonly BreakdownDimension[] = [
  "commission", "tribu", "coordination", "intendance", "pays", "continent", "volet",
];

export function ParticipationByEntity({
  allowCross = true,
  title,
}: {
  allowCross?: boolean;
  title?: string;
}): JSX.Element {
  const { session } = useDirection();
  const [dim, setDim] = useState<BreakdownDimension>("commission");
  const [cross, setCross] = useState<BreakdownDimension | "">("");

  const res = useResource<EntityBreakdownRow[] | null>(
    () => getParticipationParEntite(session.token, dim, cross || undefined),
    [session.token, dim, cross],
  );

  const crossOptions = useMemo(() => DIMENSIONS.filter((d) => d !== dim), [dim]);

  return (
    <ChartCard
      title={title ?? `Assiduité par ${DIMENSION_LABEL[dim].toLowerCase()}${cross ? ` × ${DIMENSION_LABEL[cross].toLowerCase()}` : ""}`}
      info={{
        measure: "Taux d'assiduité et de mobilisation agrégés par entité, toutes activités confondues.",
        formula: "Assiduité = présents / pointages · Mobilisation = (présents + 0,5·partiels) / pointages",
        limits: "Le croisement suppose que l'API expose l'endpoint /admin/participation/par-entite avec paramètre cross.",
      }}
    >
      <div className="dashboard-toolbar" style={{ marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="muted small" style={{ margin: "0 0 4px" }}>Dimension principale</p>
          <DimensionPicker value={dim} onChange={(d) => { setDim(d); if (d === cross) setCross(""); }} dimensions={DIMENSIONS} />
        </div>
        {allowCross && (
          <div>
            <p className="muted small" style={{ margin: "0 0 4px" }}>Croiser avec (optionnel)</p>
            <div className="segmented" role="group" aria-label="Dimension de croisement">
              <button type="button" className={`segmented-btn${cross === "" ? " is-active" : ""}`} aria-pressed={cross === ""} onClick={() => setCross("")}>Aucun</button>
              {crossOptions.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`segmented-btn${cross === d ? " is-active" : ""}`}
                  aria-pressed={cross === d}
                  onClick={() => setCross(d)}
                >
                  {DIMENSION_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {res.loading && !res.data ? (
        <SkeletonChart height={240} />
      ) : res.error ? (
        <ErrorState title="Impossible de charger la répartition" message={res.error} onRetry={res.reload} />
      ) : res.data === null ? (
        <PendingDataState
          title="Endpoint de répartition par entité non exposé"
          needs="/api/v1/admin/participation/par-entite?dimension={commission|tribu|coordination|intendance|pays|continent|volet} avec support optionnel de ?cross="
        />
      ) : (
        <EntityBreakdown
          rows={res.data}
          dimensionLabel={cross ? `${DIMENSION_LABEL[dim]} × ${DIMENSION_LABEL[cross]}` : DIMENSION_LABEL[dim]}
          emptyTitle={`Aucune donnée agrégée par ${DIMENSION_LABEL[dim].toLowerCase()}`}
          emptyDescription="L'API a répondu mais n'a retourné aucune ligne exploitable."
        />
      )}
      <p className="cross-note">
        Astuce : combine une coordination avec une commission (ou une intendance avec une commission) pour repérer les
        entités les plus / moins assidues au sein d'un périmètre.
      </p>
    </ChartCard>
  );
}
