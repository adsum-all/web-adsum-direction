// Absences & motifs — volume d'absences global + placeholders explicites pour
// les données que l'API n'expose pas encore (catégories de motifs, statut
// excusé / non excusé). Neutralité statistique.

import { useMemo } from "react";

import { ChartCard } from "../components/ChartCard.js";
import { Kpi } from "../components/Kpi.js";
import { PageHeader, RefreshBar } from "../components/PageHeader.js";
import { PendingDataState } from "../components/PendingDataState.js";
import { DonutChart } from "../components/Charts.js";
import { EmptyState, ErrorState, SkeletonChart } from "../components/States.js";
import { useDirection } from "../DirectionContext.js";

export function AbsencesPage(): JSX.Element {
  const { participation, reloadAll, isRefreshing, lastUpdate } = useDirection();
  const events = participation.data?.serie_evenements ?? [];

  const totals = useMemo(() => events.reduce(
    (acc, e) => ({
      presents: acc.presents + e.presents,
      partiels: acc.partiels + e.partiels,
      absents: acc.absents + e.absents,
    }),
    { presents: 0, partiels: 0, absents: 0 },
  ), [events]);

  const totalPointages = totals.presents + totals.partiels + totals.absents;
  const tauxAbsence = totalPointages > 0
    ? Math.round((totals.absents / totalPointages) * 100)
    : null;

  return (
    <>
      <PageHeader
        eyebrow="Direction"
        title="Absences & motifs"
        description="Volume d'absences, catégorisation des motifs et qualification administrative."
      />
      <RefreshBar onReload={reloadAll} isRefreshing={isRefreshing} lastUpdate={lastUpdate} />

      {participation.error && (
        <div style={{ marginBottom: 18 }}>
          <ErrorState message={participation.error} onRetry={participation.reload} />
        </div>
      )}

      <div className="kpi-grid">
        <Kpi
          label="Absences enregistrées"
          value={totals.absents}
          hint="tous événements cumulés"
        />
        <Kpi
          label="Taux d'absence brut"
          value={tauxAbsence === null ? "—" : `${tauxAbsence}%`}
          hint="absents / pointages"
          info={{
            measure: "Part d'absences sur l'ensemble des pointages enregistrés.",
            formula: "absents / (présents + partiels + absents) × 100",
          }}
        />
        <Kpi
          label="Absences excusées"
          value="—"
          hint="qualification administrative"
          info={{
            measure: "Absences reconnues comme excusées après examen d'un responsable habilité.",
            limits: "Nécessite un flux Pilotage / Back-office et un endpoint de qualification. Non exposé actuellement.",
          }}
        />
        <Kpi
          label="En attente d'examen"
          value="—"
          hint="qualification administrative"
          info={{
            measure: "Absences déclarées mais non encore qualifiées par un responsable.",
            limits: "Nécessite le flux d'examen côté back.",
          }}
        />
      </div>

      <div className="card-grid-2">
        <ChartCard
          title="Répartition présence / absence"
          info={{
            measure: "Composition globale des pointages.",
            formula: "présents / partiels / absents",
          }}
        >
          {participation.loading && !participation.data
            ? <SkeletonChart height={220} />
            : totalPointages === 0
              ? <EmptyState title="Aucun pointage enregistré." />
              : (
                <DonutChart
                  centerLabel="pointages"
                  unit="pointages"
                  segments={[
                    { label: "Présents", value: totals.presents },
                    { label: "Partiels", value: totals.partiels },
                    { label: "Absents", value: totals.absents },
                  ]}
                />
              )}
        </ChartCard>

        <ChartCard
          title="Motifs d'absence"
          info={{
            measure: "Répartition des raisons déclarées par les membres absents.",
            limits: "Données non exposées par l'API — nécessite l'ajout du champ absence_reason_category.",
          }}
        >
          <PendingDataState
            title="Catégories de motifs non disponibles"
            needs="Endpoint exposant, par membre absent, la catégorie de raison déclarée (santé, professionnel, familial, déplacement, conflit horaire, autre)."
            note="Une fois exposées, ces catégories permettront la répartition et le suivi dans le temps."
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Qualification administrative"
        info={{
          measure: "Suivi des décisions excusé / non excusé prises par les responsables.",
          limits: "Nécessite un flux dédié côté back-office et Pilotage.",
        }}
      >
        <PendingDataState
          title="Flux de qualification non exposé"
          needs="Endpoint de décision (excusée / non excusée / en attente) avec auteur, date et périmètre."
        />
      </ChartCard>
    </>
  );
}
