// Cross-tabulations: pick two axes, read the matrix, read each axis on its own.
//
// This is the page the direction asked for by name. The old breakdown could answer
// "how many per commission" and, with a second dimension, produced rows labelled
// "Commission A - En ligne", which is a cross-tab a reader has to pivot by eye.
//
// Here the two axes are chosen explicitly, the matrix is a matrix with its margins,
// and the same filtered data is shown as a ranked comparison underneath, because a
// heatmap answers "where is the concentration" and a ranking answers "who is doing
// badly". Both questions get asked about the same screen.

import { useMemo, useState } from "react";

import { CrossTab } from "../charts/CrossTab.js";
import { RankedBars } from "../charts/RankedBars.js";
import { ExportBar } from "../components/ExportBar.js";
import { FilterBar } from "../components/FilterBar.js";
import { PageHeader } from "../components/PageHeader.js";
import { ErrorState, SkeletonChart } from "../components/States.js";
import { useDirection } from "../DirectionContext.js";
import { getCatalogue, getCroisement, getRepartition } from "../directionApi.js";
import { useResource } from "../useResource.js";

const MESURES = [
  { cle: "presents", label: "Venus sur place" },
  { cle: "participants", label: "Ont suivi, sur place ou à distance" },
  { cle: "absents", label: "N'ont pas suivi" },
  { cle: "total", label: "Membres attendus" },
];

export function CrossingsPage(): JSX.Element {
  const { session, filtres } = useDirection();
  const jeton = session.token;
  const cle = JSON.stringify(filtres.filtres);

  const [lignes, setLignes] = useState("commission");
  const [colonnes, setColonnes] = useState("modalite");
  const [mesure, setMesure] = useState("presents");

  const catalogue = useResource(() => getCatalogue(jeton), [jeton]);
  const croise = useResource(
    () => getCroisement(jeton, filtres.filtres, lignes, colonnes, mesure),
    [jeton, cle, lignes, colonnes, mesure],
  );
  const repartition = useResource(
    () => getRepartition(jeton, filtres.filtres, lignes),
    [jeton, cle, lignes],
  );

  const dims = catalogue.data?.dimensions ?? [];
  // Grouped so the reader sees that crossing a member trait with an activity trait is
  // the combination that says something: "does this commission follow online".
  const groupes = useMemo(() => ({
    membre: dims.filter((d) => d.famille === "membre"),
    activite: dims.filter((d) => d.famille === "activite"),
  }), [dims]);

  const memeAxe = lignes === colonnes;

  return (
    <>
      <PageHeader
        title="Croisements"
        description="Croisez deux variables et lisez le tableau dans les deux sens, en effectifs ou en pourcentages."
      />
      <FilterBar token={jeton} etat={filtres} />

      <section className="card">
        <div className="croisement-axes">
          <SelecteurAxe
            id="axe-lignes" label="En lignes" valeur={lignes}
            groupes={groupes} onChange={setLignes}
          />
          <SelecteurAxe
            id="axe-colonnes" label="En colonnes" valeur={colonnes}
            groupes={groupes} onChange={setColonnes}
          />
          <label htmlFor="axe-mesure">
            <span>Mesure</span>
            <select id="axe-mesure" value={mesure} onChange={(e) => setMesure(e.target.value)}>
              {MESURES.map((m) => <option key={m.cle} value={m.cle}>{m.label}</option>)}
            </select>
          </label>
        </div>

        {memeAxe && (
          <p className="banner banner-warn small">
            Choisissez deux variables différentes : croiser une variable avec elle-même ne produit aucune information.
          </p>
        )}

        {croise.loading && <SkeletonChart />}
        {croise.error && !croise.loading && <ErrorState message={croise.error} onRetry={croise.reload} />}
        {croise.data && !croise.loading && !memeAxe && (
          <>
            <ExportBar
              titre={`Croisement ${croise.data.axe_lignes.libelle} x ${croise.data.axe_colonnes.libelle}`}
              colonnes={["", ...croise.data.axe_colonnes.valeurs, "Total"]}
              lignesTableau={croise.data.axe_lignes.valeurs.map((l) => [
                l,
                ...croise.data!.axe_colonnes.valeurs.map((c) =>
                  String(croise.data!.cellules.find((x) => x.ligne === l && x.colonne === c)?.valeur ?? 0)),
                String(croise.data!.totaux_lignes.find((t) => t.label === l)?.valeur ?? 0),
              ])}
              filtres={filtres.filtres}
            />
            <CrossTab donnees={croise.data} />
          </>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Comparaison par {dims.find((d) => d.cle === lignes)?.libelle.toLowerCase() ?? "entité"}</h2>
        <p className="muted small">
          Le même périmètre, lu entité par entité. Le repère sur la barre marque le taux de suivi, la barre elle-même le volume observé.
        </p>
        {repartition.loading && <SkeletonChart />}
        {repartition.error && !repartition.loading && (
          <ErrorState message={repartition.error} onRetry={repartition.reload} />
        )}
        {repartition.data && !repartition.loading && (
          <>
            <ExportBar
              titre={`Répartition par ${dims.find((d) => d.cle === lignes)?.libelle ?? lignes}`}
              colonnes={["Entité", "Sur place", "À distance", "N'ont pas suivi", "Attendus", "Part qui a suivi"]}
              lignesTableau={repartition.data.map((r) => [
                // The columns name the channel axis, so they must read the channel
                // fields. "partiels" holds only the partial online follow-ups, so a
                // column headed "à distance" fed from it under-reported by everyone
                // who followed online in full.
                r.label, String(r.presentiel), String(r.en_ligne), String(r.absents),
                String(r.total), `${r.taux_suivi} %`,
              ])}
              filtres={filtres.filtres}
            />
            <RankedBars lignes={repartition.data} limite={14} />
          </>
        )}
      </section>
    </>
  );
}

function SelecteurAxe({
  id, label, valeur, groupes, onChange,
}: {
  id: string; label: string; valeur: string;
  groupes: { membre: { cle: string; libelle: string }[]; activite: { cle: string; libelle: string }[] };
  onChange: (v: string) => void;
}): JSX.Element {
  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={valeur} onChange={(e) => onChange(e.target.value)}>
        <optgroup label="Caractéristique du membre">
          {groupes.membre.map((d) => <option key={d.cle} value={d.cle}>{d.libelle}</option>)}
        </optgroup>
        <optgroup label="Caractéristique de l'activité">
          {groupes.activite.map((d) => <option key={d.cle} value={d.cle}>{d.libelle}</option>)}
        </optgroup>
      </select>
    </label>
  );
}
