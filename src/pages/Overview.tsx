// The landing view: the headline figures, the attendance curve, where to look next.
//
// Everything on this page is cut from the same consolidated attendance under the
// same filters, so the cards, the curve and the ranking cannot contradict one
// another. That was the defect worth fixing here: the page used to mix a global
// membership count with an unfiltered participation series and a period selector
// that governed only one panel of the three.
//
// Coverage is stated on the page rather than buried. An attendance rate measured on
// a third of the base is a statement about that third, and a direction reading it as
// the organisation's rate would act on it.

import { useMemo } from "react";

import { TrendChart } from "../charts/TrendChart.js";
import { RankedBars } from "../charts/RankedBars.js";
import { couleur, formatDateCourte, formatNombre, formatTaux } from "../charts/geometry.js";
import { ChartCard } from "../components/ChartCard.js";
import { ExportBar } from "../components/ExportBar.js";
import { FilterBar } from "../components/FilterBar.js";
import { Kpi } from "../components/Kpi.js";
import { PageHeader, RefreshBar } from "../components/PageHeader.js";
import { EmptyState, ErrorState, SkeletonChart, SkeletonKpi } from "../components/States.js";
import { useDirection } from "../DirectionContext.js";
import { getAssiduite, getRepartition, getSerie, getSynthese } from "../directionApi.js";
import { pickLiveActivity } from "../useLiveActivity.js";
import { useResource } from "../useResource.js";
import type { RouteKey } from "../router.js";

export function OverviewPage({ onNavigate }: { onNavigate: (r: RouteKey) => void }): JSX.Element {
  const { session, filtres, participation, reloadAll, isRefreshing, lastUpdate } = useDirection();
  const jeton = session.token;
  const cle = JSON.stringify(filtres.filtres);

  const synthese = useResource(() => getSynthese(jeton, filtres.filtres), [jeton, cle]);
  const serie = useResource(() => getSerie(jeton, filtres.filtres), [jeton, cle]);
  const assiduite = useResource(() => getAssiduite(jeton, filtres.filtres), [jeton, cle]);
  const parCommission = useResource(
    () => getRepartition(jeton, filtres.filtres, "commission"), [jeton, cle],
  );

  const s = synthese.data;
  const points = serie.data ?? [];

  // The rate is drawn against a fixed hundred rather than a scale that adapts to the
  // data: an axis topping out at the highest point makes a flat series look dramatic,
  // which is the classic way a true chart tells a false story.
  const courbe = useMemo(() => ({
    libelles: points.map((p) => formatDateCourte(p.date)),
    titres: points.map((p) => p.titre),
    dates: points.map((p) => p.date),
    series: [
      { cle: "presence", label: "Taux de présence", couleur: couleur(0), valeurs: points.map((p) => p.taux_presence), aire: true },
      { cle: "participation", label: "Taux de suivi (présents et partiels)", couleur: couleur(1), valeurs: points.map((p) => p.taux_participation) },
    ],
  }), [points]);

  const volumes = useMemo(() => ({
    libelles: points.map((p) => formatDateCourte(p.date)),
    titres: points.map((p) => p.titre),
    dates: points.map((p) => p.date),
    series: [
      { cle: "presents", label: "Présents", couleur: couleur(1), valeurs: points.map((p) => p.presents), aire: true },
      { cle: "enligne", label: "Dont en ligne", couleur: couleur(4), valeurs: points.map((p) => p.en_ligne) },
      { cle: "absents", label: "Absents", couleur: couleur(5), valeurs: points.map((p) => p.absents) },
    ],
  }), [points]);

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
        description="Présence consolidée : une seule présence par membre et par activité, quelle que soit la source."
      />
      <FilterBar token={jeton} etat={filtres} />
      <RefreshBar onReload={reloadAll} isRefreshing={isRefreshing} lastUpdate={lastUpdate} />

      {synthese.error && (
        <div style={{ marginBottom: 18 }}>
          <ErrorState title="Impossible de charger la synthèse" message={synthese.error} onRetry={synthese.reload} />
        </div>
      )}

      <section aria-label="Indicateurs clés">
        <div className="kpi-grid">
          {synthese.loading && !s ? (
            <><SkeletonKpi /><SkeletonKpi /><SkeletonKpi /><SkeletonKpi /></>
          ) : (
            <>
              <Kpi
                label="Taux de présence"
                value={s?.taux_presence}
                suffix="%"
                accent
                hint={`${formatNombre(s?.presents ?? 0)} présences sur ${formatNombre(s?.observations ?? 0)} observations`}
                info={{
                  measure: "Part des observations où le membre était présent.",
                  formula: "présents / (présents + partiels + absents) x 100",
                  population: "Présences consolidées : pointage QR, pointage manuel, session en ligne et déclaration validée, dédupliqués par membre et par activité.",
                  limits: "Un membre sans aucun enregistrement n'entre pas dans le calcul. Voir le taux de couverture.",
                }}
              />
              <Kpi
                label="Taux de suivi"
                value={s?.taux_participation}
                suffix="%"
                hint={`${formatNombre(s?.partiels ?? 0)} suivis partiels inclus`}
                info={{
                  measure: "Part des observations où le membre a suivi, totalement ou partiellement.",
                  formula: "(présents + partiels) / observations x 100",
                }}
              />
              <Kpi
                label="Taux de couverture"
                value={s?.taux_couverture}
                suffix="%"
                hint={`${formatNombre(s?.membres_vus ?? 0)} membres observés sur ${formatNombre(s?.membres_actifs ?? 0)} actifs`}
                info={{
                  measure: "Part des membres actifs pour lesquels la plateforme détient au moins une observation sur le périmètre.",
                  formula: "membres observés / membres actifs x 100",
                  limits: "Une couverture basse rend les taux ci-dessus non représentatifs de l'ensemble.",
                }}
              />
              <Kpi
                label="Présence moyenne"
                value={s?.moyenne_par_activite}
                hint={`${formatNombre(s?.activites ?? 0)} activités, dont ${formatNombre(s?.scannes ?? 0)} présences scannées`}
                info={{
                  measure: "Nombre moyen de présents par activité sur le périmètre.",
                  formula: "présents / nombre d'activités",
                }}
              />
            </>
          )}
        </div>
      </section>

      {s && s.taux_couverture < 60 && (
        <p className="banner banner-warn small">
          Attention : seuls {formatTaux(s.taux_couverture)} des membres actifs ont au moins une observation
          sur ce périmètre. Les taux ci-dessus décrivent cette fraction, pas l'ensemble de l'organisation.
        </p>
      )}

      <ChartCard
        title="Évolution de la présence, activité par activité"
        hint={<>{points.length} activité{points.length > 1 ? "s" : ""} sur le périmètre filtré</>}
        info={{
          measure: "Taux de présence et taux de suivi pour chaque activité, dans l'ordre chronologique.",
          formula: "Par activité : présents / observations, et (présents + partiels) / observations.",
          limits: "Un point par activité, sans lissage mensuel : une assemblée et une réunion hebdomadaire ne sont pas moyennées ensemble.",
        }}
      >
        {serie.loading && !serie.data
          ? <SkeletonChart height={260} />
          : (
            <>
              <TrendChart {...courbe} unite="%" maxForce={100} hauteur={260}
                messageVide="Aucune activité sur le périmètre retenu." />
              {points.length > 0 && (
                <ExportBar
                  titre="Évolution de la présence"
                  colonnes={["Date", "Activité", "Volet", "Présents", "Partiels", "Absents", "Total", "Taux de présence"]}
                  lignesTableau={points.map((p) => [
                    p.date?.slice(0, 10) ?? "", p.titre, p.volet, String(p.presents),
                    String(p.partiels), String(p.absents), String(p.total), `${p.taux_presence} %`,
                  ])}
                  filtres={filtres.filtres}
                />
              )}
            </>
          )}
      </ChartCard>

      <div className="card-grid-2">
        <ChartCard
          title="Volumes et modalité de suivi"
          hint="présents, dont en ligne, et absents"
          info={{
            measure: "Effectifs bruts par activité, avec la part suivie en ligne.",
            formula: "Comptage des observations consolidées par activité.",
            limits: "Un membre scanné est compté en présentiel même s'il a déclaré autre chose : le scan est la seule preuve physique.",
          }}
        >
          {serie.loading && !serie.data
            ? <SkeletonChart height={220} />
            : <TrendChart {...volumes} hauteur={220} messageVide="Aucune activité sur le périmètre retenu." />}
        </ChartCard>

        <ChartCard
          title="Assiduité des membres"
          hint={assiduite.data ? `médiane ${formatTaux(assiduite.data.taux_median)}` : ""}
          info={{
            measure: "Répartition des membres selon la part des activités qu'ils suivent.",
            formula: "Par membre : activités suivies / activités observées, puis classement par tranche.",
            limits: "Un membre comptant moins de deux observations n'est pas classé : une seule absence ne fait pas un décrochage.",
          }}
        >
          {assiduite.loading && !assiduite.data ? (
            <SkeletonChart height={220} />
          ) : assiduite.data && assiduite.data.membres_classes > 0 ? (
            <>
              <ul className="cohortes">
                {assiduite.data.cohortes.map((c, i) => (
                  <li key={c.cle}>
                    <span className="cohorte-label">{c.label}</span>
                    <span className="cohorte-piste" aria-hidden="true">
                      <span className="cohorte-remplie" style={{ width: `${c.part}%`, background: couleur(i) }} />
                    </span>
                    <span className="cohorte-valeur">{c.membres}</span>
                    <span className="cohorte-part">{formatTaux(c.part)}</span>
                  </li>
                ))}
              </ul>
              <p className="muted small">
                {assiduite.data.membres_classes} membres classés, moyenne {formatTaux(assiduite.data.taux_moyen)}.
                {assiduite.data.membres_donnees_insuffisantes > 0 && (
                  <> {assiduite.data.membres_donnees_insuffisantes} membre
                    {assiduite.data.membres_donnees_insuffisantes > 1 ? "s" : ""} non classé
                    {assiduite.data.membres_donnees_insuffisantes > 1 ? "s" : ""}, faute d'observations suffisantes.</>
                )}
              </p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate("members")}>
                Voir qui décroche
              </button>
            </>
          ) : (
            <EmptyState title="Pas encore d'assiduité mesurable" description="Aucun membre ne compte assez d'observations sur ce périmètre." />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Comparaison par commission"
        hint="volume observé et taux de suivi"
        info={{
          measure: "Présence consolidée par commission sur le périmètre filtré.",
          formula: "Barre = volume observé, repère = taux de suivi.",
          limits: "Une commission comptant moins de dix observations est signalée : son taux est trop sensible pour être classé.",
        }}
      >
        {parCommission.loading && !parCommission.data
          ? <SkeletonChart height={240} />
          : (
            <>
              <RankedBars lignes={parCommission.data ?? []} limite={10} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate("crossings")}>
                Croiser avec une autre variable
              </button>
            </>
          )}
      </ChartCard>

      <ChartCard
        title="Activité en direct"
        hint={live.mode === "live" ? "en cours" : live.mode === "last" ? "dernière activité" : live.mode === "planned" ? "à venir" : "aucune"}
        info={{
          measure: "Aperçu rapide de l'activité en cours ou de la dernière activité terminée.",
          formula: "Sélection = activité démarrée dans les 4 dernières heures, sinon la plus récente.",
          limits: "Ce panneau ignore les filtres : il suit toujours l'activité la plus récente.",
        }}
      >
        {participation.loading && !participation.data ? (
          <SkeletonChart height={200} />
        ) : liveEv ? (
          <div className="live-summary">
            <div>
              <span className={`live-pill live-pill-${live.mode}`}>
                {live.mode === "live" ? "En cours"
                  : live.mode === "planned" ? "À venir" : "Dernière activité"}
              </span>
              <p className="live-summary-title">{liveEv.titre}</p>
              <p className="muted small">{liveEv.volet || "Volet non renseigné"}</p>
            </div>
            {live.mode === "planned" ? (
              // Zeros are not shown for something that has not happened: a row of
              // zeros under a title reads as a failed activity, not as a diary entry.
              <p className="muted small">
                Activité programmée : aucun pointage n'est encore attendu.
                Les chiffres apparaîtront une fois l'activité commencée.
              </p>
            ) : (
              <div className="live-stats">
                <div><b>{liveEv.presents}</b><span>présents</span></div>
                <div><b>{liveEv.partiels}</b><span>partiels</span></div>
                <div><b>{liveEv.absents}</b><span>absents</span></div>
                <div><b>{liveRate !== null ? `${liveRate}%` : "-"}</b><span>mobilisation</span></div>
              </div>
            )}
            <button type="button" className="btn btn-primary btn-inline" onClick={() => onNavigate("live")}>
              Ouvrir la page dédiée
            </button>
          </div>
        ) : (
          <EmptyState title="Aucune activité disponible" description="Aucun événement avec pointage n'a été trouvé." />
        )}
      </ChartCard>
    </>
  );
}
