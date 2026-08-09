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
      // The names say the inclusion out loud. Somebody on site has followed, so the
      // lower curve is contained in the upper one: calling them "présence" and "suivi"
      // read as two competing measures of the same thing.
      {
        cle: "presence",
        label: "Venus sur place",
        couleur: couleur(0),
        valeurs: points.map((p) => p.taux_presence),
        aire: true,
      },
      {
        cle: "participation",
        label: "Ont suivi, sur place ou à distance",
        couleur: couleur(1),
        valeurs: points.map((p) => p.taux_participation),
      },
    ],
  }), [points]);

  const volumes = useMemo(() => ({
    libelles: points.map((p) => formatDateCourte(p.date)),
    titres: points.map((p) => p.titre),
    dates: points.map((p) => p.date),
    series: [
      { cle: "presents", label: "Venus sur place", couleur: couleur(1), valeurs: points.map((p) => p.presentiel), aire: true },
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
                label="Part qui a suivi"
                value={s?.taux_participation}
                suffix="%"
                accent
                hint={`${formatNombre(s?.suivis ?? 0)} suivis sur ${formatNombre(s?.observations ?? 0)} observations`}
                info={{
                  measure: "Part des observations où la personne a suivi l'activité, en présentiel ou en ligne, complètement ou partiellement.",
                  formula: "(présentiel confirmé + présentiel déclaré + en ligne complet + en ligne partiel) / observations x 100",
                  population: "Une observation par membre et par activité, consolidée sur les deux sources de pointage. Un membre scanné qui répond aussi au sondage compte une seule fois.",
                  limits: `Exclut ${formatNombre(s?.non_interpretables ?? 0)} enregistrement(s) antérieur(s) au nouveau modèle, dont le sens ne peut pas être établi. Un membre sans aucun enregistrement n'entre pas dans le calcul : voir le taux de couverture.`,
                }}
              />
              <Kpi
                label="Part prouvée au contrôle"
                value={s?.taux_preuve}
                suffix="%"
                hint={`${formatNombre(s?.presentiel_prouve ?? 0)} présences scannées sur ${formatNombre(s?.suivis ?? 0)} suivis`}
                info={{
                  measure: "Part des suivis reposant sur un pointage QR ou manuel confirmé par l'équipe de contrôle, et non sur la déclaration du membre.",
                  formula: "présentiel confirmé au contrôle / total des suivis x 100",
                  limits: "Une part faible ne signifie pas que les chiffres sont faux : elle signifie qu'ils reposent sur la parole des membres plutôt que sur une preuve. Deux unités au même taux de suivi ne sont pas dans la même situation si l'une est prouvée et l'autre déclarée.",
                }}
              />
              <Kpi
                label="Taux de couverture"
                value={s?.taux_couverture}
                suffix="%"
                hint={`${formatNombre(s?.membres_vus ?? 0)} membres observés sur ${formatNombre(s?.membres_actifs ?? 0)} du périmètre`}
                info={{
                  measure: "Part des membres du périmètre pour lesquels la plateforme détient au moins une observation.",
                  formula: "membres observés / membres actifs du périmètre x 100",
                  limits: "Le dénominateur suit les filtres d'organisation (coordination, intendance, commission), pas les filtres de période : restreindre la fenêtre ne réduit pas l'effectif. Une couverture basse rend les taux ci-dessus non représentatifs.",
                }}
              />
              <Kpi
                label="Suivis par activité"
                value={s?.moyenne_par_activite}
                hint={`${formatNombre(s?.activites ?? 0)} activités sur le périmètre`}
                info={{
                  measure: "Nombre moyen de personnes présentes par activité.",
                  formula: "présents / nombre d'activités",
                  limits: "Une moyenne sur peu d'activités varie fortement d'une activité à l'autre.",
                }}
              />
            </>
          )}
        </div>
      </section>

      {s && s.suivis > 0 && (
        <section className="card" aria-label="Décomposition du suivi">
          <h2 className="card-title">Comment les {formatNombre(s.suivis)} suivis se répartissent</h2>
          <p className="muted small">
            Les cinq lignes totalisent exactement le nombre de suivis affiché ci-dessus.
            Une présence confirmée au contrôle et une présence déclarée par le membre sont
            deux faits différents et ne sont jamais additionnées sans le dire.
          </p>
          <ul className="decomposition">
            {[
              { cle: "prouve", label: "Présentiel confirmé au contrôle", n: s.presentiel_prouve, aide: "Pointage QR ou manuel validé par un contrôleur. C'est la seule preuve de présence physique." },
              { cle: "declare", label: "Présentiel déclaré par le membre", n: s.presentiel_declare, aide: "Le membre affirme être venu sur place. Non vérifié." },
              { cle: "complet", label: "En ligne, suivi complet", n: s.en_ligne_complet, aide: "Le membre déclare avoir suivi l'activité en entier à distance." },
              { cle: "partiel", label: "En ligne, suivi partiel", n: s.en_ligne_partiel, aide: "Le membre déclare avoir suivi une partie seulement. Le suivi partiel n'existe qu'en ligne." },
              { cle: "inconnue", label: "Suivi, modalité non précisée", n: s.suivi_modalite_inconnue, aide: "La personne a suivi mais n'a pas indiqué comment." },
            ].filter((x) => x.n > 0).map((x) => (
              <li key={x.cle} title={x.aide}>
                <span className="decomposition-label">{x.label}</span>
                <span className="decomposition-piste" aria-hidden="true">
                  <span className={`decomposition-part decomposition-${x.cle}`} style={{ width: `${(100 * x.n) / s.suivis}%` }} />
                </span>
                <strong className="decomposition-n">{formatNombre(x.n)}</strong>
                <span className="decomposition-pct">{formatTaux((100 * x.n) / s.suivis)}</span>
              </li>
            ))}
          </ul>
          {s.non_interpretables > 0 && (
            <p className="banner banner-warn small">
              {formatNombre(s.non_interpretables)} enregistrement(s) antérieur(s) au nouveau modèle
              sont exclus de tous les taux : leur sens ne peut pas être établi avec certitude.
              Ils sont conservés en base et jamais réécrits.
            </p>
          )}
        </section>
      )}

      {s && s.taux_couverture < 60 && (
        <p className="banner banner-warn small">
          Attention : seuls {formatTaux(s.taux_couverture)} des membres actifs ont au moins une observation
          sur ce périmètre. Les taux ci-dessus décrivent cette fraction, pas l'ensemble de l'organisation.
        </p>
      )}

      <ChartCard
        title="Suivi des activités, l'une après l'autre"
        hint={<>{points.length} activité{points.length > 1 ? "s" : ""} sur le périmètre filtré</>}
        info={{
          measure: "Pour chaque activité, la part des membres attendus qui sont venus sur place, et la part de ceux qui l'ont suivie par un moyen ou un autre.",
          formula: "Venus sur place = présentiel / attendus. Ont suivi = (présentiel + à distance) / attendus. La première courbe est toujours sous la seconde : venir sur place, c'est suivre.",
          limits: "Un point par activité, sans lissage mensuel : une assemblée et une réunion hebdomadaire ne sont pas moyennées ensemble. L'écart entre les deux courbes est exactement le suivi à distance.",
        }}
      >
        {serie.loading && !serie.data
          ? <SkeletonChart height={260} />
          : (
            <>
              <div id="courbe-presence">
                <TrendChart {...courbe} unite="%" maxForce={100} hauteur={260}
                  messageVide="Aucune activité sur le périmètre retenu." />
              </div>
              {points.length > 0 && (
                <ExportBar
                  titre="Évolution de la présence"
                  colonnes={["Date", "Activité", "Volet", "Sur place", "À distance", "N'ont pas suivi", "Attendus", "Part venue sur place"]}
                  lignesTableau={points.map((p) => [
                    p.date?.slice(0, 10) ?? "", p.titre, p.volet, String(p.presentiel),
                    String(p.en_ligne), String(p.absents), String(p.total), `${p.taux_presence} %`,
                  ])}
                  filtres={filtres.filtres}
                  cibleImage={() => document.querySelector<SVGSVGElement>("#courbe-presence svg.graphe-svg")}
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
