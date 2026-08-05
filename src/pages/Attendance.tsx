// Assiduité - distribution du cheminement, dynamique d'entrée et taux
// d'assiduité par entité (commission, tribu, coordination, intendance…).

import { useMemo } from "react";

import { ChartCard } from "../components/ChartCard.js";
import { BarChart, LineChart } from "../components/Charts.js";
import { Kpi } from "../components/Kpi.js";
import { PageHeader, RefreshBar } from "../components/PageHeader.js";
import { PendingDataState } from "../components/PendingDataState.js";
import { SkeletonChart } from "../components/States.js";
import { Tabs } from "../components/Tabs.js";
import { useDirection } from "../DirectionContext.js";
import { CHEMINEMENT_LABELS, seriesToChart } from "../labels.js";
import { ParticipationByEntity } from "./ParticipationByEntity.js";

const ACTIVE_KEYS = new Set(["membre_actif", "responsable", "en_accompagnement"]);
const RISK_KEYS = new Set(["a_relancer", "en_pause"]);

export function AttendancePage(): JSX.Element {
  const { stats, reloadAll, isRefreshing, lastUpdate } = useDirection();
  const data = stats.data;

  const total = data?.membres_total ?? 0;
  const cheminement = data?.par_cheminement ?? [];
  const active = cheminement.filter((r) => ACTIVE_KEYS.has(r.cheminement)).reduce((a, r) => a + r.total, 0);
  const risk = cheminement.filter((r) => RISK_KEYS.has(r.cheminement)).reduce((a, r) => a + r.total, 0);
  const inactive = cheminement.filter((r) => r.cheminement === "ancien_membre").reduce((a, r) => a + r.total, 0);
  const activeRate = total > 0 ? Math.round((active / total) * 100) : null;
  const riskRate = total > 0 ? Math.round((risk / total) * 100) : null;

  const distribution = useMemo(() => cheminement
    .map((r) => ({ label: CHEMINEMENT_LABELS[r.cheminement] ?? r.cheminement, value: r.total }))
    .sort((a, b) => b.value - a.value), [cheminement]);

  const monthly = useMemo(() => seriesToChart(data?.entrees_mensuelles ?? []), [data]);

  return (
    <>
      <PageHeader
        eyebrow="Direction"
        title="Assiduité"
        description="Distribution des membres, signaux de décrochage et dynamique d'entrée."
      />
      <RefreshBar onReload={reloadAll} isRefreshing={isRefreshing} lastUpdate={lastUpdate} />

      <div className="kpi-grid">
        <Kpi
          label="Membres actifs"
          value={active}
          hint={activeRate !== null ? `${activeRate}% de l'annuaire` : ""}
          info={{
            measure: "Membres dont le cheminement est reconnu comme actif.",
            formula: "membre_actif + responsable + en_accompagnement",
          }}
        />
        <Kpi
          label="Signaux de décrochage"
          value={risk}
          hint={riskRate !== null ? `${riskRate}% à relancer / en pause` : ""}
          info={{
            measure: "Membres marqués « à relancer » ou « en pause ».",
            limits: "Ne remplace pas une analyse individuelle de la fréquence de participation.",
          }}
        />
        <Kpi
          label="Anciens membres"
          value={inactive}
          hint="cheminement clôturé"
        />
        <Kpi
          label="Nouveaux (12 mois)"
          value={(data?.entrees_mensuelles ?? []).slice(-12).reduce((a, r) => a + r.total, 0)}
          hint="entrées sur un an"
        />
      </div>

      <Tabs
        ariaLabel="Vues de l'assiduité"
        tabs={[
          {
            key: "distribution",
            label: "Distribution",
            content: (
              <ChartCard
                title="Distribution du cheminement"
                info={{
                  measure: "Répartition détaillée des membres par cheminement pastoral.",
                  formula: "COUNT(membres) group by cheminement, tri décroissant",
                }}
              >
                {stats.loading && !data
                  ? <SkeletonChart height={260} />
                  : <BarChart items={distribution} orientation="horizontal" unit="membres" />}
              </ChartCard>
            ),
          },
          {
            key: "dynamique",
            label: "Dynamique d'entrée",
            content: (
              <ChartCard
                title="Nouvelles adhésions sur 12 mois"
                info={{
                  measure: "Courbe des nouvelles adhésions mensuelles.",
                  formula: "Somme mensuelle des entrées",
                }}
              >
                {stats.loading && !data
                  ? <SkeletonChart height={220} />
                  : <LineChart points={monthly.slice(-12)} unit="membres" />}
              </ChartCard>
            ),
          },
          {
            key: "entity",
            label: "Assiduité par entité",
            hint: "Taux d'assiduité par commission, tribu, coordination, intendance, pays, continent",
            content: <ParticipationByEntity />,
          },
          {
            key: "individual",
            label: "Individuelle",
            content: (
              <ChartCard
                title="Assiduité individuelle"
                info={{
                  measure: "Suivi de la fréquence de participation par membre.",
                  limits: "Nécessite un endpoint exposant, par membre, l'historique de présence sur une fenêtre glissante.",
                }}
              >
                <PendingDataState
                  title="Historique par membre non disponible"
                  needs="Endpoint agrégeant, par membre, présences complètes / partielles / absences sur 90 jours glissants."
                />
              </ChartCard>
            ),
          },
        ]}
      />
    </>
  );
}
