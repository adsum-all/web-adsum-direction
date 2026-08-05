// Participation — tendances, comparaisons, tableau paginé et répartition
// par entité (commission, tribu, coordination, intendance, pays, continent).

import { useMemo, useState } from "react";

import { ChartCard } from "../components/ChartCard.js";
import { BarChart, LineChart, StackedBar } from "../components/Charts.js";
import { Kpi } from "../components/Kpi.js";
import { PageHeader, RefreshBar } from "../components/PageHeader.js";
import { Paginator, usePagination } from "../components/Paginator.js";
import { computeTrend, PeriodSelector, usePeriodFilter, type PeriodKey } from "../components/PeriodSelector.js";
import { EmptyState, ErrorState, SkeletonChart } from "../components/States.js";
import { Tabs } from "../components/Tabs.js";
import { useDirection } from "../DirectionContext.js";
import { seriesToChart } from "../labels.js";
import { ParticipationByEntity } from "./ParticipationByEntity.js";

export function ParticipationPage(): JSX.Element {
  const { stats, participation, reloadAll, isRefreshing, lastUpdate } = useDirection();
  const [period, setPeriod] = useState<PeriodKey>("12m");

  const monthly = stats.data?.entrees_mensuelles ?? [];
  const filtered = usePeriodFilter(monthly, period);
  const entries = useMemo(() => seriesToChart(filtered), [filtered]);
  const window = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  const trend = computeTrend(monthly, window);

  const events = participation.data?.serie_evenements ?? [];
  const sortedEvents = useMemo(() => [...events].sort((a, b) => {
    const ta = a.debut ? Date.parse(a.debut) : 0;
    const tb = b.debut ? Date.parse(b.debut) : 0;
    return tb - ta;
  }), [events]);

  const byVolet = useMemo(() => {
    const map = new Map<string, { presents: number; partiels: number; absents: number }>();
    events.forEach((e) => {
      const key = e.volet || "Sans volet";
      const cur = map.get(key) ?? { presents: 0, partiels: 0, absents: 0 };
      cur.presents += e.presents; cur.partiels += e.partiels; cur.absents += e.absents;
      map.set(key, cur);
    });
    return [...map.entries()].map(([label, v]) => ({
      label,
      total: v.presents + v.partiels + v.absents,
      ...v,
      taux: v.presents + v.partiels + v.absents > 0
        ? Math.round(((v.presents + 0.5 * v.partiels) / (v.presents + v.partiels + v.absents)) * 100)
        : 0,
    }));
  }, [events]);

  const topActivities = useMemo(() => [...events]
    .map((e) => ({ label: e.titre, value: e.presents + e.partiels }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8), [events]);

  const global = participation.data?.repartition_globale;
  const totalPointages = global ? global.presents + global.partiels + global.absents : 0;
  const tauxAssiduite = totalPointages > 0 ? Math.round((global!.presents / totalPointages) * 100) : null;
  const tauxMobilisation = totalPointages > 0
    ? Math.round(((global!.presents + 0.5 * global!.partiels) / totalPointages) * 100)
    : null;

  return (
    <>
      <PageHeader
        eyebrow="Direction"
        title="Participation & assiduité"
        description="Taux d'assiduité, mobilisation et répartitions par volet, activité et entité (commission, tribu, coordination, intendance, pays, continent)."
      />
      <RefreshBar
        onReload={reloadAll}
        isRefreshing={isRefreshing}
        lastUpdate={lastUpdate}
        extra={<PeriodSelector value={period} onChange={setPeriod} />}
      />

      <div className="kpi-grid">
        <Kpi
          label="Taux d'assiduité global"
          value={tauxAssiduite === null ? "—" : `${tauxAssiduite}%`}
          hint="présents / pointages"
          accent
          info={{
            measure: "Part des pointages en présence complète, toutes activités confondues.",
            formula: "Σ présents / Σ (présents + partiels + absents) × 100",
          }}
        />
        <Kpi
          label="Taux de mobilisation"
          value={tauxMobilisation === null ? "—" : `${tauxMobilisation}%`}
          hint="pondère les partiels à 0,5"
          info={{
            measure: "Vue lissée intégrant les présences partielles.",
            formula: "Σ (présents + 0,5·partiels) / Σ pointages × 100",
          }}
        />
        <Kpi
          label="Événements suivis"
          value={participation.data?.nb_evenements}
          hint="avec pointage enregistré"
        />
        <Kpi
          label="Sur place / en ligne"
          value={global ? `${global.presentiel.toLocaleString("fr-FR")} / ${global.en_ligne.toLocaleString("fr-FR")}` : "—"}
          hint="modalités confondues"
          info={{
            measure: "Répartition globale des présences par modalité.",
            formula: "COUNT(modalité = 'presentiel') vs COUNT(modalité = 'en_ligne')",
          }}
        />
      </div>

      <Tabs
        ariaLabel="Vues de la participation"
        tabs={[
          {
            key: "trends",
            label: "Tendances",
            content: (
              <ChartCard
                title="Évolution mensuelle des entrées"
                hint={`${entries.length} mois`}
                info={{
                  measure: "Nouvelles entrées mensuelles.",
                  formula: "COUNT(nouvelles adhésions) par mois",
                  period: "Selon le sélecteur de période",
                }}
              >
                {stats.loading && !stats.data
                  ? <SkeletonChart height={240} />
                  : <LineChart points={entries} unit="membres" emptyMessage="Aucune entrée sur la période sélectionnée." />}
                {trend && (
                  <p className="cross-note">
                    Fenêtre {window} mois : {trend.current.toLocaleString("fr-FR")} entrées
                    {trend.deltaPct !== null ? ` (${trend.deltaPct > 0 ? "+" : ""}${trend.deltaPct}% vs période précédente)` : ""}.
                  </p>
                )}
              </ChartCard>
            ),
          },
          {
            key: "volet",
            label: "Par volet",
            content: (
              <div className="card-grid-2">
                <ChartCard
                  title="Présences par volet"
                  info={{
                    measure: "Cumul présents + partiels par volet.",
                    formula: "Σ (présents + partiels) group by volet",
                  }}
                >
                  {participation.loading && !participation.data
                    ? <SkeletonChart height={220} />
                    : byVolet.length === 0
                      ? <EmptyState title="Aucune activité avec présence." />
                      : <BarChart items={byVolet.map((v) => ({ label: v.label, value: v.presents + v.partiels }))} orientation="horizontal" unit="présences" />}
                </ChartCard>
                <ChartCard
                  title="Taux de mobilisation par volet"
                  info={{
                    measure: "Efficacité relative de chaque volet.",
                    formula: "(présents + 0,5·partiels) / pointages × 100",
                  }}
                >
                  {byVolet.length === 0
                    ? <EmptyState title="Aucune donnée par volet." />
                    : <BarChart items={byVolet.map((v) => ({ label: v.label, value: v.taux }))} orientation="horizontal" unit="%" />}
                </ChartCard>
              </div>
            ),
          },
          {
            key: "activity",
            label: "Par activité",
            content: (
              <>
                <ChartCard
                  title="Activités les plus mobilisatrices"
                  hint="top 8"
                  info={{
                    measure: "Classement des activités par volume de présences.",
                    formula: "présents + partiels, tri décroissant",
                  }}
                >
                  {topActivities.length === 0
                    ? <EmptyState title="Aucune activité." />
                    : <BarChart items={topActivities} orientation="horizontal" unit="présences" topN={8} />}
                </ChartCard>
                <ActivityDetailList events={sortedEvents} error={participation.error} onReload={participation.reload} />
              </>
            ),
          },
          {
            key: "entity",
            label: "Par entité",
            hint: "Assiduité par commission, tribu, coordination, intendance, pays, continent",
            content: <ParticipationByEntity />,
          },
        ]}
      />
    </>
  );
}

function ActivityDetailList({
  events, error, onReload,
}: {
  events: { id: string; titre: string; volet: string; presents: number; partiels: number; absents: number }[];
  error: string | null;
  onReload: () => void;
}): JSX.Element {
  const pager = usePagination(events, 4);
  return (
    <section className="card" aria-label="Détail des activités">
      <div className="section-head">
        <div className="section-title-row"><h2>Détail par activité</h2></div>
        <span className="hint">{events.length} activité{events.length > 1 ? "s" : ""}</span>
      </div>
      {error ? (
        <ErrorState title="Impossible de charger" message={error} onRetry={onReload} />
      ) : events.length === 0 ? (
        <EmptyState title="Aucune activité disponible" />
      ) : (
        <>
          <div className="event-list">
            {pager.slice.map((ev) => {
              const total = ev.presents + ev.partiels + ev.absents;
              const rate = total > 0 ? Math.round(((ev.presents + 0.5 * ev.partiels) / total) * 100) : null;
              return (
                <article className="event-card" key={ev.id}>
                  <header className="event-card-head">
                    <div>
                      <p className="event-card-title">{ev.titre}</p>
                      <p className="muted small">{ev.volet || "Volet non renseigné"}</p>
                    </div>
                    <span className="event-card-rate">{rate !== null ? `${rate}%` : "—"}</span>
                  </header>
                  <StackedBar presents={ev.presents} partiels={ev.partiels} absents={ev.absents} />
                  <p className="event-card-meta">
                    {ev.presents} présents · {ev.partiels} partiels · {ev.absents} absents · total {total}
                  </p>
                </article>
              );
            })}
          </div>
          <Paginator
            page={pager.page} totalPages={pager.totalPages} from={pager.from} to={pager.to} total={pager.total}
            pageSize={pager.pageSize} onPageSizeChange={pager.setPageSize}
            onPrev={pager.prev} onNext={pager.next} canPrev={pager.canPrev} canNext={pager.canNext}
            label="Pagination des activités"
          />
        </>
      )}
    </section>
  );
}

