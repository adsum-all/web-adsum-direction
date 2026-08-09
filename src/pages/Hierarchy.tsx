// The organisation chart published from the back office, plus the attendance tree.
//
// Two hierarchies, and they answer different questions. The published chart is the
// structure the organisation has declared: who reports to whom, which posts are
// vacant. The attendance tree is the same organisation measured: which coordination,
// which stewardship, which commission actually turns up.
//
// Kept on one page and apart from one another, because conflating them is how a
// vacant post gets read as a unit with no attendance. Nothing here is editable: the
// chart is governed in the back office and the direction reads it.

import { useMemo, useState } from "react";

import { formatNombre, formatTaux } from "../charts/geometry.js";
import { ExportBar } from "../components/ExportBar.js";
import { PageHeader } from "../components/PageHeader.js";
import { ErrorState, SkeletonChart } from "../components/States.js";
import { Tabs } from "../components/Tabs.js";
import { useDirection } from "../DirectionContext.js";
import {
  getArborescence, getOrganigrammePublie,
  type Noeud, type OrganigrammeNoeud, type OrganigrammePublie,
} from "../directionApi.js";
import { useResource } from "../useResource.js";

export function HierarchyPage(): JSX.Element {
  const { session, filtres } = useDirection();
  const jeton = session.token;

  return (
    <>
      <PageHeader
        title="Hiérarchie"
        description="La structure publiée depuis le back-office, et la même organisation mesurée par l'assiduité."
      />
      <Tabs
        ariaLabel="Vues de la hiérarchie"
        tabs={[
          {
            key: "structure",
            label: "Organigramme publié",
            hint: "La structure déclarée, telle qu'elle a été publiée depuis le back-office.",
            content: <Structure token={jeton} />,
          },
          {
            key: "assiduite",
            label: "Assiduité par échelon",
            hint: "La même organisation, mesurée par la présence effective.",
            content: <ParEchelon token={jeton} etat={filtres} />,
          },
        ]}
      />
    </>
  );
}

// --- Published chart --------------------------------------------------------

interface Arbre { noeud: OrganigrammeNoeud; enfants: Arbre[] }

function Structure({ token }: { token: string }): JSX.Element {
  const organigramme = useResource(() => getOrganigrammePublie(token), [token]);
  const [recherche, setRecherche] = useState("");

  const arbres = useMemo(() => construire(organigramme.data), [organigramme.data]);

  return (
    <section className="card">
      {organigramme.loading && <SkeletonChart />}
      {organigramme.error && !organigramme.loading && (
        <ErrorState message={organigramme.error} onRetry={organigramme.reload} />
      )}
      {organigramme.data && !organigramme.loading && (
        organigramme.data.version === null ? (
          <p className="graphe-vide">
            Aucun organigramme n'est publié. La structure se prépare et se publie depuis le back-office.
          </p>
        ) : (
          <>
            <div className="table-barre">
              <p className="muted small">
                Version <strong>{organigramme.data.version.libelle}</strong>
                {organigramme.data.version.publie_le && (
                  <> , publiée le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" })
                    .format(new Date(organigramme.data.version.publie_le))}</>
                )}
                {" "}, {formatNombre(organigramme.data.noeuds.length)} entrées.
              </p>
              <label htmlFor="orga-recherche">
                <span>Rechercher</span>
                <input
                  id="orga-recherche" type="search" value={recherche}
                  placeholder="Nom, fonction, unité"
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </label>
            </div>
            <ArbreOrganigramme arbres={arbres} recherche={recherche.trim().toLowerCase()} />
          </>
        )
      )}
    </section>
  );
}

/** Turn the flat node and link lists into rooted trees. */
function construire(data: OrganigrammePublie | null): Arbre[] {
  if (!data) return [];
  const parId = new Map<string, Arbre>();
  data.noeuds.forEach((n) => parId.set(n.id, { noeud: n, enfants: [] }));
  const aUnParent = new Set<string>();
  data.liens.forEach((l) => {
    const parent = parId.get(l.source_id);
    const enfant = parId.get(l.cible_id);
    // A link pointing at a node the version does not contain is skipped rather than
    // dropping the child: an incomplete chart still shows what it does hold.
    if (!parent || !enfant) return;
    parent.enfants.push(enfant);
    aUnParent.add(l.cible_id);
  });
  return data.noeuds.filter((n) => !aUnParent.has(n.id)).map((n) => parId.get(n.id)!).filter(Boolean);
}

function libelleNoeud(n: OrganigrammeNoeud): string {
  return n.membre_nom || n.nom || "Poste à pourvoir";
}

function correspond(a: Arbre, terme: string): boolean {
  if (!terme) return true;
  const texte = `${libelleNoeud(a.noeud)} ${a.noeud.sous_titre ?? ""} ${a.noeud.categorie ?? ""}`.toLowerCase();
  return texte.includes(terme) || a.enfants.some((e) => correspond(e, terme));
}

function ArbreOrganigramme({ arbres, recherche }: { arbres: Arbre[]; recherche: string }): JSX.Element {
  const visibles = arbres.filter((a) => correspond(a, recherche));
  if (visibles.length === 0) {
    return <p className="graphe-vide">Aucune entrée ne correspond à cette recherche.</p>;
  }
  return (
    <ul className="arbre">
      {visibles.map((a) => <Branche key={a.noeud.id} arbre={a} recherche={recherche} profondeur={0} />)}
    </ul>
  );
}

function Branche({ arbre, recherche, profondeur }: { arbre: Arbre; recherche: string; profondeur: number }): JSX.Element {
  // Two levels open by default: everything open buries the top of a six-hundred-node
  // chart, everything closed hides the structure the page exists to show. A search
  // opens whatever matched.
  const [ouvert, setOuvert] = useState(profondeur < 2);
  const enfants = arbre.enfants.filter((e) => correspond(e, recherche));
  const deplie = ouvert || (recherche !== "" && enfants.length > 0);
  const vacant = !arbre.noeud.membre_nom && !arbre.noeud.nom;

  return (
    <li className="arbre-item">
      <div className="arbre-noeud">
        {enfants.length > 0 ? (
          <button
            type="button"
            className="arbre-bascule"
            aria-expanded={deplie}
            onClick={() => setOuvert((v) => !v)}
            aria-label={deplie ? "Replier" : "Déplier"}
          >
            {deplie ? "-" : "+"}
          </button>
        ) : <span className="arbre-puce" aria-hidden="true" />}
        <span className={`arbre-nom${vacant ? " est-vacant" : ""}`}>{libelleNoeud(arbre.noeud)}</span>
        {arbre.noeud.sous_titre && <span className="arbre-role">{arbre.noeud.sous_titre}</span>}
        {typeof arbre.noeud.effectif === "number" && arbre.noeud.effectif > 0 && (
          <span className="etiquette etiquette-neutre">{arbre.noeud.effectif} membres</span>
        )}
        {enfants.length > 0 && (
          <span className="muted small">{enfants.length} rattachement{enfants.length > 1 ? "s" : ""}</span>
        )}
      </div>
      {deplie && enfants.length > 0 && (
        <ul className="arbre">
          {enfants.map((e) => (
            <Branche key={e.noeud.id} arbre={e} recherche={recherche} profondeur={profondeur + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

// --- Attendance by level ----------------------------------------------------

function ParEchelon({ token, etat }: { token: string; etat: ReturnType<typeof useDirection>["filtres"] }): JSX.Element {
  const cle = JSON.stringify(etat.filtres);
  const arbre = useResource(() => getArborescence(token, etat.filtres), [token, cle]);

  const lignesPlates = useMemo(() => aplatir(arbre.data ?? []), [arbre.data]);

  return (
    <section className="card">
      <p className="muted small">
        Chaque échelon affiche exactement la somme de ses enfants. Dépliez une coordination pour
        trouver l'intendance ou la commission qui porte l'écart.
      </p>
      {arbre.loading && <SkeletonChart />}
      {arbre.error && !arbre.loading && <ErrorState message={arbre.error} onRetry={arbre.reload} />}
      {arbre.data && !arbre.loading && (
        arbre.data.length === 0 ? (
          <p className="graphe-vide">Aucune donnée d'assiduité sur le périmètre retenu.</p>
        ) : (
          <>
            <ExportBar
              titre="Assiduité par échelon"
              colonnes={["Niveau", "Entité", "Sur place", "À distance", "N'ont pas suivi", "Attendus", "Part qui a suivi"]}
              lignesTableau={lignesPlates}
              filtres={etat.filtres}
            />
            <ul className="arbre arbre-mesure">
              {arbre.data.map((n) => <BrancheMesure key={`${n.niveau}-${n.label}`} noeud={n} profondeur={0} />)}
            </ul>
          </>
        )
      )}
    </section>
  );
}

function aplatir(noeuds: Noeud[], prefixe = ""): string[][] {
  return noeuds.flatMap((n) => {
    const nom = prefixe ? `${prefixe} > ${n.label}` : n.label;
    const ligne = [
      n.niveau, nom, String(n.presentiel), String(n.en_ligne), String(n.absents),
                String(n.total), `${n.taux_suivi} %`,
    ];
    return [ligne, ...aplatir(n.enfants ?? [], nom)];
  });
}

function BrancheMesure({ noeud, profondeur }: { noeud: Noeud; profondeur: number }): JSX.Element {
  const [ouvert, setOuvert] = useState(profondeur === 0);
  const enfants = noeud.enfants ?? [];
  return (
    <li className="arbre-item">
      <div className="arbre-noeud arbre-noeud-mesure">
        {enfants.length > 0 ? (
          <button
            type="button" className="arbre-bascule" aria-expanded={ouvert}
            onClick={() => setOuvert((v) => !v)}
            aria-label={ouvert ? "Replier" : "Déplier"}
          >
            {ouvert ? "-" : "+"}
          </button>
        ) : <span className="arbre-puce" aria-hidden="true" />}
        <span className="arbre-nom">{noeud.label}</span>
        <span className="arbre-mesures">
          <span className="jauge jauge-large" aria-hidden="true">
            <span className="jauge-remplie" style={{ width: `${Math.min(100, noeud.taux_participation)}%` }} />
          </span>
          <span className="mesure-taux">{formatTaux(noeud.taux_participation)}</span>
          <span className="muted small">{formatNombre(noeud.total)} observations</span>
        </span>
      </div>
      {ouvert && enfants.length > 0 && (
        <ul className="arbre">
          {enfants.map((e) => (
            <BrancheMesure key={`${e.niveau}-${e.label}`} noeud={e} profondeur={profondeur + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
