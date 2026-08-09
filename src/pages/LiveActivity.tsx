// Activité en direct - page dédiée à UNE activité (en cours ou dernière).
// Bascule automatique dès qu'une nouvelle activité entre dans la fenêtre live.
// Onglets si plusieurs activités simultanées.

import { useEffect, useMemo, useRef, useState } from "react";

import { ArrivalsChart } from "../components/ArrivalsChart.js";
import { ChartCard } from "../components/ChartCard.js";
import { DonutChart, PresenceLegend, StackedBar } from "../components/Charts.js";
import { Kpi } from "../components/Kpi.js";
import { LiveModalityChart } from "../components/LiveModalityChart.js";
import { PageHeader, RefreshBar } from "../components/PageHeader.js";
import { EmptyState, ErrorState, SkeletonChart, SkeletonKpi } from "../components/States.js";
import { Tabs } from "../components/Tabs.js";
import { useDirection } from "../DirectionContext.js";
import { formatEventDate, pickLiveActivity, type LiveEvent } from "../useLiveActivity.js";
import { LiveBreakdownTab } from "./LiveBreakdownTab.js";

export function LiveActivityPage(): JSX.Element {
  const { participation, reloadAll, isRefreshing, lastUpdate } = useDirection();
  const selection = useMemo(
    () => pickLiveActivity(participation.data?.serie_evenements),
    [participation.data],
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  // Auto-recalage : dès que la référence (activité la plus récente) change,
  // on reset la sélection manuelle pour afficher la nouvelle activité.
  const refId = selection.reference?.id ?? null;
  const prevRefId = useRef<string | null>(refId);
  useEffect(() => {
    if (refId !== prevRefId.current) {
      prevRefId.current = refId;
      setActiveId(null);
    }
  }, [refId]);

  const events = selection.current;
  const currentEvent: LiveEvent | null = events.length === 0
    ? null
    : events.find((e) => e.id === activeId) ?? events[0]!;

  return (
    <>
      <PageHeader
        eyebrow="Direction · temps réel"
        title="Activité en direct"
        description="Page dédiée à une seule activité : celle en cours, sinon la plus récente. Bascule automatiquement au démarrage d'une nouvelle activité."
      />
      <RefreshBar onReload={reloadAll} isRefreshing={isRefreshing} lastUpdate={lastUpdate} />

      {participation.error ? (
        <ErrorState title="Impossible de charger l'activité" message={participation.error} onRetry={participation.reload} />
      ) : participation.loading && !participation.data ? (
        <>
          <SkeletonChart height={90} />
          <div style={{ height: 12 }} />
          <div className="kpi-grid"><SkeletonKpi /><SkeletonKpi /><SkeletonKpi /><SkeletonKpi /></div>
        </>
      ) : !currentEvent ? (
        <EmptyState
          title="Aucune activité disponible"
          description="Aucune activité planifiée n'a été détectée. Dès qu'un événement démarre et reçoit un pointage, il s'affichera ici automatiquement."
        />
      ) : (
        <>
          {events.length > 1 && (
            <div className="tabs" role="tablist" aria-label="Activités simultanées en cours">
              {events.map((ev) => {
                const active = ev.id === currentEvent.id;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`tab${active ? " is-active" : ""}`}
                    onClick={() => setActiveId(ev.id)}
                  >
                    {ev.titre}
                  </button>
                );
              })}
            </div>
          )}

          <section className="card live-header" aria-label="En-tête activité">
            <div>
              <span className={`live-pill live-pill-${selection.mode}`}>
                {selection.mode === "live" ? "● En cours" : "Dernière activité terminée"}
              </span>
              <h2 className="live-title">{currentEvent.titre}</h2>
              <p className="muted small">
                {currentEvent.volet || "Volet non renseigné"} · {formatEventDate(currentEvent.debut)}
              </p>
            </div>
          </section>

          <LiveKpis event={currentEvent} />

          <Tabs
            ariaLabel="Vues de l'activité en direct"
            tabs={[
              {
                key: "global",
                label: "Vue globale",
                content: (
                  <>
                    <div className="card-grid-2">
                      <ChartCard
                        title="Répartition des présences"
                        info={{
                          measure: "Ventilation des membres pointés en présents, partiels et absents.",
                          formula: "Comptage brut des pointages",
                          population: "Membres pointés pour cette activité",
                        }}
                      >
                        <PresenceLegend />
                        <div style={{ marginTop: 12 }}>
                          <StackedBar
                            presents={currentEvent.presents}
                            partiels={currentEvent.partiels}
                            absents={currentEvent.absents}
                            height={16}
                          />
                        </div>
                        <div style={{ marginTop: 16 }}>
                          <DonutChart
                            centerLabel="pointages"
                            unit="membres"
                            segments={[
                              { label: "Présents", value: currentEvent.presents },
                              { label: "Partiels", value: currentEvent.partiels },
                              { label: "Absents", value: currentEvent.absents },
                            ]}
                          />
                        </div>
                      </ChartCard>

                      <ChartCard
                        title="Sur place vs en ligne"
                        info={{
                          measure: "Répartition estimée des présences par modalité pour cette activité.",
                          formula: "Ratio global présentiel / en ligne × présents de l'activité",
                          limits: "Projection : l'API n'expose pas encore la modalité par activité.",
                        }}
                      >
                        <LiveModalityChart
                          presents={currentEvent.presents}
                          ratioPresentiel={participation.data?.repartition_globale.presentiel ?? 0}
                          ratioEnLigne={participation.data?.repartition_globale.en_ligne ?? 0}
                        />
                      </ChartCard>
                    </div>

                    <ChartCard
                      title="Évolution des arrivées"
                      info={{
                        measure: "Courbe cumulative des pointages sur le créneau de l'activité.",
                        formula: "Distribution en cloche calibrée sur les totaux réels (présents + partiels).",
                        limits: "Projection indicative - sera remplacée par les horodatages exacts dès leur exposition par l'API.",
                      }}
                    >
                      <ArrivalsChart
                        presents={currentEvent.presents}
                        partiels={currentEvent.partiels}
                        startISO={currentEvent.debut}
                      />
                    </ChartCard>
                  </>
                ),
              },
              {
                key: "breakdown",
                label: "Répartition détaillée",
                hint: "Assiduité par commission, tribu, coordination, intendance, pays, continent, volet",
                content: <LiveBreakdownTab eventId={currentEvent.id} />,
              },
            ]}
          />
        </>
      )}
    </>
  );
}

function LiveKpis({ event }: { event: LiveEvent }): JSX.Element {
  const total = event.presents + event.partiels + event.absents;
  const rateBrut = total > 0 ? Math.round((event.presents / total) * 100) : null;
  const rateMobilization = total > 0
    ? Math.round(((event.presents + 0.5 * event.partiels) / total) * 100)
    : null;
  return (
    <div className="kpi-grid">
      <Kpi
        label="Membres pointés"
        value={total}
        hint="présents + partiels + absents"
        info={{
          measure: "Volume de pointages enregistrés pour cette activité.",
          limits: "Le nombre de membres attendus par activité n'est pas encore exposé par l'API.",
        }}
      />
      <Kpi
        label="Taux de participation brut"
        value={rateBrut === null ? "-" : `${rateBrut}%`}
        hint="présents / pointages"
        info={{
          measure: "Part de membres présents sur l'ensemble des pointages.",
          formula: "présents / (présents + partiels + absents) × 100",
        }}
      />
      <Kpi
        label="Taux de mobilisation"
        value={rateMobilization === null ? "-" : `${rateMobilization}%`}
        hint="pondère les partiels à 0,5"
        info={{
          measure: "Estimation lissée intégrant les présences partielles.",
          formula: "(présents + 0,5 × partiels) / (présents + partiels + absents) × 100",
          limits: "Coefficient partiel = 0,5 par convention. À paramétrer côté back si besoin.",
        }}
      />
      <Kpi
        label="Absents"
        value={event.absents}
        hint="tous motifs confondus"
        info={{
          measure: "Nombre de membres pointés absents pour cette activité.",
          limits: "La qualification excusée / non excusée nécessite un flux administratif côté back.",
        }}
      />
    </div>
  );
}
