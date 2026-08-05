// Vue d'ensemble — synthèse des indicateurs clés + accès direct à l'activité.

import { useMemo, useState } from "react";

import { ChartCard } from "../components/ChartCard.js";
import { LineChart, type ChartDatum } from "../components/Charts.js";
import { Kpi } from "../components/Kpi.js";
import { PageHeader, RefreshBar } from "../components/PageHeader.js";
import { computeTrend, PeriodSelector, usePeriodFilter, type PeriodKey } from "../components/PeriodSelector.js";
import { EmptyState, ErrorState, SkeletonChart, SkeletonKpi } from "../components/States.js";
import { useDirection } from "../DirectionContext.js";
import { seriesToChart } from "../labels.js";
import { pickLiveActivity } from "../useLiveActivity.js";
import type { RouteKey } from "../router.js";

export function OverviewPage({ onNavigate }: { onNavigate: (r: RouteKey) => void }): JSX.Element {
  const { stats, participation, reloadAll, isRefreshing, lastUpdate } = useDirection();
  const [period, setPeriod] = useState<PeriodKey>("12m");

  const data = stats.data;
  const monthly = data?.entrees_mensuelles ?? [];
  const filtered = usePeriodFilter(monthly, period);
  const entries: ChartDatum[] = useMemo(() => seriesToChart(filtered), [filtered]);
  const trendWindow = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  const entriesTrend = computeTrend(monthly, trendWindow);
  const sparklinePoints = useMemo(() => seriesToChart(monthly.slice(-12)), [monthly]);
  const tauxVerif = data && data.membres_total > 0
    ? Math.round((data.membres_verifies / data.membres_total) * 100)
    : 0;

  const live = pickLiveActivity(participation.data?.serie_evenements);
  const liveEv = live.reference;
  const liveTotal = liveEv ? liveEv.presents + liveEv.partiels + liveEv.absents : 0;
  const liveRate = liveEv && liveTotal > 0
    ? Math.round(((liveEv.presents + 0.5 * liveEv.partiels) / liveTotal) * 100)
    : null;

  return (
    <>
      <PageHeader
        eyebrow="Direction"
        title="Vue d'ensemble"
        description="Synthèse consolidée du Sacerdoce Royal, actualisée automatiquement."
      />
      <RefreshBar
        onReload={reloadAll}
        isRefreshing={isRefreshing}
        lastUpdate={lastUpdate}
        extra={<PeriodSelector value={period} onChange={setPeriod} />}
      />

      {stats.error && (
        <div style={{ marginBottom: 18 }}>
          <ErrorState title="Impossible de charger les indicateurs" message={stats.error} onRetry={stats.reload} />
        </div>
      )}

      <section aria-label="Indicateurs clés">
        <div className="kpi-grid">
          {stats.loading && !data ? (
            <><SkeletonKpi /><SkeletonKpi /><SkeletonKpi /><SkeletonKpi /></>
          ) : (
            <>
              <Kpi
                label="Membres"
                value={data?.membres_total}
                hint={`${(data?.membres_actifs ?? 0).toLocaleString("fr-FR")} actifs`}
                accent
                sparkline={sparklinePoints}
                info={{
                  measure: "Nombre total de membres enregistrés dans l'annuaire.",
                  formula: "COUNT(membres) — hors suppression logique.",
                  population: "Ensemble de l'annuaire du Sacerdoce Royal.",
                }}
              />
              <Kpi
                label="Taux de vérification"
                value={tauxVerif}
                suffix="%"
                hint={`${(data?.membres_en_attente ?? 0).toLocaleString("fr-FR")} en attente`}
                info={{
                  measure: "Part des membres dont l'identité a été vérifiée.",
                  formula: "membres vérifiés / membres total × 100",
                  limits: "Ne distingue pas les motifs de non-vérification.",
                }}
              />
              <Kpi
                label="Nouvelles entrées"
                value={entriesTrend?.current ?? 0}
                hint={period === "3m" ? "sur 3 mois" : period === "6m" ? "sur 6 mois" : period === "ytd" ? "depuis janvier" : "sur 12 mois"}
                trend={entriesTrend?.deltaPct ?? null}
                trendComparisonLabel="vs période précédente équivalente"
                info={{
                  measure: "Somme des nouvelles adhésions sur la période sélectionnée.",
                  formula: "Σ entrées_mensuelles sur la fenêtre choisie",
                  period: "Fenêtre glissante alignée sur le sélecteur de période.",
                  limits: "Comparaison affichée uniquement si l'historique couvre deux fenêtres complètes.",
                }}
              />
              <Kpi
                label="Présences cumulées"
                value={data?.presences_total}
                hint={`${(data?.evenements_total ?? 0).toLocaleString("fr-FR")} événements`}
                info={{
                  measure: "Nombre total de présences enregistrées, tous événements confondus.",
                  formula: "COUNT(pointages présents ou partiels)",
                }}
              />
            </>
          )}
        </div>
      </section>

      <div className="card-grid-2">
        <ChartCard
          title="Tendance des entrées"
          hint={<>{period === "3m" ? "3 derniers mois" : period === "6m" ? "6 derniers mois" : period === "ytd" ? "année en cours" : "12 derniers mois"} · unité : membres</>}
          info={{
            measure: "Évolution du nombre de nouvelles adhésions.",
            formula: "Somme mensuelle des entrées",
            period: "Selon le sélecteur ci-dessus",
          }}
        >
          {stats.loading && !data
            ? <SkeletonChart height={220} />
            : <LineChart points={entries} unit="membres" emptyMessage="Aucune entrée sur la période sélectionnée." />}
        </ChartCard>

        <ChartCard
          title="Activité en direct"
          hint={live.mode === "live" ? "en cours" : live.mode === "last" ? "dernière activité" : "aucune"}
          info={{
            measure: "Aperçu rapide de l'activité en cours ou de la dernière activité terminée.",
            formula: "Sélection = activité démarrée dans les 4 dernières heures, sinon la plus récente.",
          }}
        >
          {participation.loading && !participation.data ? (
            <SkeletonChart height={200} />
          ) : liveEv ? (
            <div className="live-summary">
              <div>
                <span className={`live-pill live-pill-${live.mode}`}>
                  {live.mode === "live" ? "● En cours" : "Dernière activité"}
                </span>
                <p className="live-summary-title">{liveEv.titre}</p>
                <p className="muted small">{liveEv.volet || "Volet non renseigné"}</p>
              </div>
              <div className="live-stats">
                <div><b>{liveEv.presents}</b><span>présents</span></div>
                <div><b>{liveEv.partiels}</b><span>partiels</span></div>
                <div><b>{liveEv.absents}</b><span>absents</span></div>
                <div><b>{liveRate !== null ? `${liveRate}%` : "—"}</b><span>mobilisation</span></div>
              </div>
              <button type="button" className="btn btn-primary btn-inline" onClick={() => onNavigate("live")}>
                Ouvrir la page dédiée
              </button>
            </div>
          ) : (
            <EmptyState title="Aucune activité disponible" description="Aucun événement avec pointage n'a été trouvé." />
          )}
        </ChartCard>
      </div>
    </>
  );
}
