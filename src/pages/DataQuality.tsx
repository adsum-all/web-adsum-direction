// Qualité des données — complétude, vérification identité, fraîcheur.

import { ChartCard } from "../components/ChartCard.js";
import { DonutChart, StackedBar } from "../components/Charts.js";
import { Kpi } from "../components/Kpi.js";
import { PageHeader, RefreshBar } from "../components/PageHeader.js";
import { EmptyState, SkeletonChart } from "../components/States.js";
import { useDirection } from "../DirectionContext.js";
import { usePagination, Paginator } from "../components/Paginator.js";

export function DataQualityPage(): JSX.Element {
  const { stats, reloadAll, isRefreshing, lastUpdate } = useDirection();
  const data = stats.data;
  const total = data?.membres_total ?? 0;
  const verified = data?.membres_verifies ?? 0;
  const pending = data?.membres_en_attente ?? 0;
  const verifRate = total > 0 ? Math.round((verified / total) * 100) : null;

  const toVerify = data?.membres_a_verifier ?? [];
  const pager = usePagination(toVerify, 4);

  const pendingSources = [
    { key: "modality_per_event", label: "Modalité par activité (présentiel / en ligne)", state: "En attente" },
    { key: "absence_reason", label: "Catégorie de motif d'absence", state: "En attente" },
    { key: "absence_review", label: "Statut administratif de l'absence (excusée / non)", state: "En attente" },
    { key: "attendance_history", label: "Historique par membre (assiduité 90 j)", state: "En attente" },
    { key: "intra_activity_timeline", label: "Horodatage intra-activité", state: "En attente" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Direction"
        title="Qualité des données"
        description="Complétude de l'annuaire, fraîcheur des indicateurs et sources en attente."
      />
      <RefreshBar onReload={reloadAll} isRefreshing={isRefreshing} lastUpdate={lastUpdate} />

      <div className="kpi-grid">
        <Kpi
          label="Taux de vérification"
          value={verifRate === null ? "—" : `${verifRate}%`}
          hint={`${verified.toLocaleString("fr-FR")} vérifiés / ${total.toLocaleString("fr-FR")}`}
          info={{
            measure: "Part des membres dont l'identité a été confirmée.",
            formula: "vérifiés / total × 100",
          }}
        />
        <Kpi label="En attente" value={pending} hint="vérification à effectuer" />
        <Kpi
          label="Fraîcheur"
          value={lastUpdate ? lastUpdate.toLocaleTimeString("fr-FR") : "—"}
          hint="dernière synchronisation"
          info={{
            measure: "Horodatage de la dernière actualisation réussie côté navigateur.",
            formula: "Timestamp local du dernier reload OK",
          }}
        />
        <Kpi label="Indicateurs en attente" value={pendingSources.length} hint="données back à exposer" />
      </div>

      <div className="card-grid-2">
        <ChartCard
          title="Vérification d'identité"
          info={{
            measure: "Part des membres vérifiés vs en attente.",
            formula: "Comptage brut",
          }}
        >
          {stats.loading && !data ? (
            <SkeletonChart height={200} />
          ) : total === 0 ? (
            <EmptyState title="Annuaire vide." />
          ) : (
            <>
              <DonutChart
                centerLabel="membres"
                unit="membres"
                segments={[
                  { label: "Vérifiés", value: verified },
                  { label: "En attente", value: pending },
                ]}
              />
              <div style={{ marginTop: 12 }}>
                <StackedBar presents={verified} partiels={0} absents={pending} />
              </div>
            </>
          )}
        </ChartCard>

        <ChartCard
          title="Sources de données en attente"
          info={{
            measure: "Ensemble des indicateurs qui nécessitent un enrichissement côté API.",
            limits: "Chaque source manquante est signalée dans la page correspondante.",
          }}
        >
          <ul className="pending-list">
            {pendingSources.map((s) => (
              <li key={s.key}>
                <span className="pending-dot" aria-hidden="true" />
                <span>{s.label}</span>
                <span className="pending-badge">{s.state}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <section className="card" aria-label="Membres à vérifier">
        <div className="section-head">
          <div className="section-title-row"><h2>Membres à vérifier</h2></div>
          <span className="hint">{toVerify.length} en file · lot de 4</span>
        </div>
        {toVerify.length === 0 ? (
          <EmptyState title="Aucun membre en attente de vérification." />
        ) : (
          <>
            <ul className="verify-list">
              {pager.slice.map((m) => (
                <li key={m.id}>
                  <span className="verify-matr">{m.matricule}</span>
                  <span className="verify-name">{[m.prenoms, m.nom].filter(Boolean).join(" ") || "—"}</span>
                </li>
              ))}
            </ul>
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
            />
          </>
        )}
      </section>
    </>
  );
}
