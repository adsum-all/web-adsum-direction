// Organisation — hub à onglets : synthèse, commissions, tribus, coordinations,
// intendances, pays. Les référentiels sont chargés depuis l'API (fallback aux
// listes statiques si le back ne les expose pas encore).

import { useMemo } from "react";

import { ChartCard } from "../components/ChartCard.js";
import { BarChart, DonutChart } from "../components/Charts.js";
import { Kpi } from "../components/Kpi.js";
import { PageHeader, RefreshBar } from "../components/PageHeader.js";
import { Tabs } from "../components/Tabs.js";
import { EmptyState, ErrorState, SkeletonChart, SkeletonBlock } from "../components/States.js";
import { useDirection } from "../DirectionContext.js";
import { CHEMINEMENT_LABELS } from "../labels.js";
import { useResource, type ResourceState } from "../useResource.js";
import {
  listAdminCoordinations, listAdminIntendances, listAdminTribus, listPays,
  listReferenceCommissions, listReferenceCoordinations, listReferenceIntendances, listReferenceTribus,
  type Commission, type Coordination, type Intendance, type Pays, type Tribu,
} from "../api.js";
import { COMMISSIONS_MISSIONS, COORDINATIONS, INTENDANCES, TRIBUS } from "../modalities.js";

type Named = { libelle?: string; nom?: string; code?: string };
const nameOf = (x: Named) => x.libelle ?? x.nom ?? x.code ?? "—";

function useOrgLists(token: string) {
  const tribus = useResource(async () => {
    const admin = await listAdminTribus(token);
    if (admin.length > 0) return admin;
    const ref = await listReferenceTribus(token);
    if (ref.length > 0) return ref;
    return TRIBUS.map((t) => ({ libelle: t } as Tribu));
  }, [token]);
  const coordinations = useResource(async () => {
    const admin = await listAdminCoordinations(token);
    if (admin.length > 0) return admin;
    const ref = await listReferenceCoordinations(token);
    if (ref.length > 0) return ref;
    return COORDINATIONS.map((c) => ({ libelle: c } as Coordination));
  }, [token]);
  const intendances = useResource(async () => {
    const admin = await listAdminIntendances(token);
    if (admin.length > 0) return admin;
    const ref = await listReferenceIntendances(token);
    if (ref.length > 0) return ref;
    return INTENDANCES.map((i) => ({ libelle: i } as Intendance));
  }, [token]);
  const commissions = useResource(async () => {
    const ref = await listReferenceCommissions(token);
    if (ref.length > 0) return ref;
    return COMMISSIONS_MISSIONS.map((c) => ({ libelle: c } as Commission));
  }, [token]);
  const pays = useResource(() => listPays(token), [token]);
  return { tribus, coordinations, intendances, commissions, pays };
}

export function OrganizationPage(): JSX.Element {
  const { stats, session, reloadAll, isRefreshing, lastUpdate } = useDirection();
  const data = stats.data;
  const org = useOrgLists(session.token);

  return (
    <>
      <PageHeader
        eyebrow="Direction"
        title="Organisation"
        description="Structures et référentiels : commissions, tribus, coordinations, intendances, pays."
      />
      <RefreshBar onReload={reloadAll} isRefreshing={isRefreshing} lastUpdate={lastUpdate} />

      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}

      <div className="kpi-grid">
        <Kpi label="Commissions" value={data?.commissions_total ?? org.commissions.data?.length} hint="structures" />
        <Kpi label="Tribus" value={org.tribus.data?.length} hint="référentiel" />
        <Kpi label="Coordinations" value={org.coordinations.data?.length} hint="référentiel" />
        <Kpi label="Intendances" value={data?.intendances_total ?? org.intendances.data?.length} hint="référentiel" />
      </div>

      <Tabs
        ariaLabel="Sections organisation"
        tabs={[
          { key: "overview", label: "Vue globale", content: <OverviewTab /> },
          { key: "commissions", label: "Commissions & missions", content: <ListTab res={org.commissions} label="commission" /> },
          { key: "tribus", label: "Tribus", content: <ListTab res={org.tribus} label="tribu" /> },
          { key: "coordinations", label: "Coordinations", content: <CoordinationsTab res={org.coordinations} /> },
          { key: "intendances", label: "Intendances", content: <ListTab res={org.intendances} label="intendance" /> },
          { key: "pays", label: "Pays & continents", content: <PaysTab res={org.pays} /> },
        ]}
      />
    </>
  );
}

function OverviewTab(): JSX.Element {
  const { stats } = useDirection();
  const data = stats.data;
  const commissions = useMemo(() => (data?.par_commission ?? [])
    .map((r) => ({ label: r.commission ?? "Sans commission", value: r.total }))
    .sort((a, b) => b.value - a.value), [data]);
  const cheminement = useMemo(() => (data?.par_cheminement ?? [])
    .map((r) => ({ label: CHEMINEMENT_LABELS[r.cheminement] ?? r.cheminement ?? "—", value: r.total }))
    .sort((a, b) => b.value - a.value), [data]);

  return (
    <>
      <ChartCard
        title="Membres par commission"
        hint="tri décroissant"
        info={{ measure: "Nombre de membres par commission.", formula: "COUNT(membres) group by commission" }}
      >
        {stats.loading && !data ? <SkeletonChart height={280} />
          : commissions.length === 0
            ? <EmptyState title="Aucune commission renseignée." description="Publier au moins une commission côté ADSUM Admin pour voir cette répartition." />
            : <BarChart items={commissions} orientation="horizontal" unit="membres" topN={12} />}
      </ChartCard>

      <ChartCard
        title="Cheminement pastoral"
        info={{ measure: "Répartition selon le cheminement pastoral.", formula: "COUNT(membres) group by cheminement" }}
      >
        {stats.loading && !data ? <SkeletonChart height={220} />
          : cheminement.length === 0
            ? <EmptyState title="Aucun cheminement renseigné." />
            : <DonutChart segments={cheminement} centerLabel="membres" unit="membres" />}
      </ChartCard>
    </>
  );
}

function ListTab({ res, label }: { res: ResourceState<Array<Named & { effectif?: number }>>; label: string }): JSX.Element {
  const data = res.data ?? [];
  if (res.loading && data.length === 0) return <div className="card"><SkeletonBlock height={140} /></div>;
  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />;
  if (data.length === 0) return (
    <div className="card">
      <EmptyState
        title={`Aucune ${label} disponible`}
        description={`Le référentiel ${label} n'est pas encore publié côté ADSUM Admin. Créez au moins une entrée pour l'afficher ici.`}
      />
    </div>
  );

  const sorted = [...data].sort((a, b) => (b.effectif ?? 0) - (a.effectif ?? 0) || nameOf(a).localeCompare(nameOf(b)));
  const withEffectif = sorted.filter((x) => typeof x.effectif === "number");

  return (
    <>
      {withEffectif.length > 0 && (
        <ChartCard
          title={`Répartition par ${label}`}
          info={{ measure: `Effectif par ${label}.`, formula: "COUNT(membres) group by entité" }}
        >
          <BarChart
            items={withEffectif.map((x) => ({ label: nameOf(x), value: x.effectif ?? 0 }))}
            orientation="horizontal"
            unit="membres"
            topN={20}
          />
        </ChartCard>
      )}

      <ChartCard title={`Liste des ${label}s`} hint={`${data.length} entrée(s)`}>
        <table className="data-table">
          <thead><tr><th scope="col">Libellé</th><th scope="col" style={{ textAlign: "right" }}>Effectif</th></tr></thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={`${nameOf(row)}-${i}`}>
                <td>{nameOf(row)}</td>
                <td style={{ textAlign: "right" }}>{row.effectif ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>
    </>
  );
}

function CoordinationsTab({ res }: { res: ResourceState<Coordination[]> }): JSX.Element {
  const data = res.data ?? [];
  if (res.loading && data.length === 0) return <div className="card"><SkeletonBlock height={140} /></div>;
  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />;
  if (data.length === 0) return (
    <div className="card">
      <EmptyState title="Aucune coordination disponible" description="Publier au moins une coordination côté ADSUM Admin." />
    </div>
  );
  const byContinent = new Map<string, number>();
  for (const c of data) {
    const k = c.continent ?? "Non renseigné";
    byContinent.set(k, (byContinent.get(k) ?? 0) + (c.effectif ?? 1));
  }
  const segs = [...byContinent.entries()].map(([label, value]) => ({ label, value }));

  return (
    <>
      <ChartCard
        title="Coordinations par continent"
        info={{ measure: "Regroupement des coordinations par continent.", limits: "Fallback : effectif = 1 par coordination si non renseigné." }}
      >
        {segs.length === 0 ? <EmptyState title="Aucun continent renseigné." /> : <DonutChart segments={segs} unit="coord." />}
      </ChartCard>
      <ChartCard title="Coordinations" hint={`${data.length} entrée(s)`}>
        <table className="data-table">
          <thead><tr><th>Libellé</th><th>Continent</th><th>Pays</th><th style={{ textAlign: "right" }}>Effectif</th></tr></thead>
          <tbody>
            {data.map((c, i) => (
              <tr key={`${nameOf(c)}-${i}`}>
                <td>{nameOf(c)}</td>
                <td>{c.continent ?? "—"}</td>
                <td>{c.pays ?? "—"}</td>
                <td style={{ textAlign: "right" }}>{c.effectif ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>
    </>
  );
}

function PaysTab({ res }: { res: ResourceState<Pays[]> }): JSX.Element {
  const data = res.data ?? [];
  if (res.loading && data.length === 0) return <div className="card"><SkeletonBlock height={140} /></div>;
  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />;
  if (data.length === 0) return (
    <div className="card">
      <EmptyState
        title="Annuaire pays indisponible"
        description="L'annuaire pays n'est pas exposé pour votre profil. Contactez un administrateur si vous en avez besoin."
      />
    </div>
  );

  const byContinent = new Map<string, number>();
  for (const p of data) {
    const k = p.continent ?? "Non renseigné";
    byContinent.set(k, (byContinent.get(k) ?? 0) + (p.effectif ?? 1));
  }
  const segs = [...byContinent.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  return (
    <>
      <ChartCard title="Répartition par continent" info={{ measure: "Effectif ou nombre de pays regroupés par continent." }}>
        <BarChart items={segs} orientation="horizontal" unit={segs.some((s) => s.value > data.length) ? "membres" : "pays"} />
      </ChartCard>
      <ChartCard title="Pays" hint={`${data.length} pays`}>
        <table className="data-table">
          <thead><tr><th>Pays</th><th>Continent</th><th>Code ISO</th><th style={{ textAlign: "right" }}>Effectif</th></tr></thead>
          <tbody>
            {data.map((p, i) => (
              <tr key={`${nameOf(p)}-${i}`}>
                <td>{nameOf(p)}</td>
                <td>{p.continent ?? "—"}</td>
                <td>{p.code_iso ?? "—"}</td>
                <td style={{ textAlign: "right" }}>{p.effectif ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>
    </>
  );
}
