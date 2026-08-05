// Onglet "Répartition détaillée" pour une activité en direct : télécharge les
// statistiques par entité pour l'événement et laisse choisir la dimension.

import { useMemo, useState } from "react";

import { getEvenementStats, type BreakdownDimension } from "../api.js";
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

export function LiveBreakdownTab({ eventId }: { eventId: string }): JSX.Element {
  const { session } = useDirection();
  const stats = useResource(
    () => getEvenementStats(session.token, eventId),
    [session.token, eventId],
  );
  const [dim, setDim] = useState<BreakdownDimension>("commission");

  const rows = useMemo(() => {
    if (!stats.data) return [];
    const map: Record<BreakdownDimension, typeof stats.data.par_commission> = {
      commission: stats.data.par_commission,
      tribu: stats.data.par_tribu,
      coordination: stats.data.par_coordination,
      intendance: stats.data.par_intendance,
      pays: stats.data.par_pays,
      continent: stats.data.par_continent,
      volet: stats.data.par_volet,
    };
    return map[dim] ?? [];
  }, [stats.data, dim]);

  if (stats.loading && !stats.data) return <SkeletonChart height={220} />;
  if (stats.error) return <ErrorState title="Impossible de charger les répartitions" message={stats.error} onRetry={stats.reload} />;
  if (!stats.data || !stats.data.hasAny) {
    return (
      <PendingDataState
        title="Répartition détaillée non disponible pour cette activité"
        needs="Endpoint /admin/evenements/{id}/participation-stats retournant les tableaux par commission, tribu, coordination, intendance, pays, continent et volet."
      />
    );
  }

  return (
    <ChartCard
      title={`Assiduité par ${DIMENSION_LABEL[dim].toLowerCase()}`}
      info={{
        measure: "Répartition des présences / partiels / absents pour l'activité sélectionnée.",
        formula: "Assiduité = présents / pointages · Mobilisation = (présents + 0,5·partiels) / pointages",
        population: "Membres pointés pour cette activité",
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <DimensionPicker value={dim} onChange={setDim} dimensions={DIMENSIONS} />
      </div>
      <EntityBreakdown
        rows={rows}
        dimensionLabel={DIMENSION_LABEL[dim]}
        emptyTitle={`Aucune donnée par ${DIMENSION_LABEL[dim].toLowerCase()}`}
        emptyDescription="L'API n'a pas retourné de ventilation pour cette dimension sur cette activité."
      />
    </ChartCard>
  );
}
