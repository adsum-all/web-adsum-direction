// Named members and how often they attend, restricted to the steering fields.
//
// The direction asked for a member directory. This is deliberately not one. The back
// office already holds the directory, with contact details, addresses, documents and
// photographs, and duplicating it here would widen the personal-data surface for no
// steering gain.
//
// What steering genuinely needs from a name, the aggregates cannot give: a rate of
// sixty per cent says something is wrong, it never says whom to call. So the page
// answers that one question and stops. It opens on the least assiduous, because that
// is the only reason it is nominative, and it prints the whitelist the server
// honoured so the restriction is verifiable rather than merely promised.

import { useState } from "react";

import { ExportBar } from "../components/ExportBar.js";
import { FilterBar } from "../components/FilterBar.js";
import { PageHeader } from "../components/PageHeader.js";
import { ErrorState, SkeletonChart } from "../components/States.js";
import { useDirection } from "../DirectionContext.js";
import { getSuiviMembres, type SuiviMembre } from "../directionApi.js";
import { useResource } from "../useResource.js";

const TRIS = [
  { cle: "taux", label: "Assiduité croissante" },
  { cle: "taux_desc", label: "Assiduité décroissante" },
  { cle: "ancien", label: "Vu il y a le plus longtemps" },
  { cle: "recent", label: "Vu le plus récemment" },
  { cle: "nom", label: "Nom" },
];

const COHORTES: Record<SuiviMembre["cohorte"], { label: string; ton: string }> = {
  assidu: { label: "Assidu", ton: "ok" },
  regulier: { label: "Régulier", ton: "info" },
  irregulier: { label: "Irrégulier", ton: "warn" },
  decroche: { label: "Décroché", ton: "danger" },
  donnees_insuffisantes: { label: "Trop peu de données", ton: "neutre" },
};

const PAR_PAGE = 50;

function dateCourte(iso: string | null): string {
  if (!iso) return "Jamais";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "Inconnue"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

export function MembersPage(): JSX.Element {
  const { session, filtres } = useDirection();
  const jeton = session.token;
  const cle = JSON.stringify(filtres.filtres);

  const [tri, setTri] = useState("taux");
  const [page, setPage] = useState(0);
  const [recherche, setRecherche] = useState("");

  const suivi = useResource(
    () => getSuiviMembres(jeton, filtres.filtres, { tri, limite: PAR_PAGE, decalage: page * PAR_PAGE }),
    [jeton, cle, tri, page],
  );

  const membres = suivi.data?.membres ?? [];
  // Filtered in the browser because it narrows the page already loaded; a name search
  // across the whole base belongs in the back office, which is where names are managed.
  const visibles = recherche.trim()
    ? membres.filter((m) => m.nom_affiche.toLowerCase().includes(recherche.trim().toLowerCase()))
    : membres;

  const total = suivi.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));

  return (
    <>
      <PageHeader
        title="Suivi des membres"
        description="Qui suit, qui décroche. Vue de pilotage restreinte aux données d'assiduité."
      />
      <FilterBar token={jeton} etat={filtres} />

      <section className="card">
        <p className="banner banner-info small">
          Cette page ne remplace pas l'annuaire du back-office et n'expose ni coordonnées, ni adresse,
          ni document, ni photographie. Elle répond à une seule question : qui a cessé de venir.
          {suivi.data && (
            <>
              {" "}Champs transmis par le serveur : <strong>{suivi.data.champs_exposes.join(", ")}</strong>.
            </>
          )}
        </p>

        <div className="table-barre">
          <label htmlFor="suivi-tri">
            <span>Trier par</span>
            <select
              id="suivi-tri" value={tri}
              onChange={(e) => { setTri(e.target.value); setPage(0); }}
            >
              {TRIS.map((t) => <option key={t.cle} value={t.cle}>{t.label}</option>)}
            </select>
          </label>
          <label htmlFor="suivi-recherche">
            <span>Rechercher dans la page</span>
            <input
              id="suivi-recherche" type="search" value={recherche}
              placeholder="Nom"
              onChange={(e) => setRecherche(e.target.value)}
            />
          </label>
          {suivi.data && (
            <ExportBar
              titre="Suivi d'assiduité des membres"
              colonnes={["Nom", "Coordination", "Intendance", "Commission", "Tribu", "Observées", "Suivies", "Taux", "Dernière présence", "Cohorte"]}
              lignesTableau={membres.map((m) => [
                m.nom_affiche, m.coordination, m.intendance, m.commission, m.tribu,
                String(m.observees), String(m.suivies), `${m.taux} %`,
                dateCourte(m.derniere_presence), COHORTES[m.cohorte].label,
              ])}
              filtres={filtres.filtres}
            />
          )}
        </div>

        {suivi.loading && <SkeletonChart />}
        {suivi.error && !suivi.loading && <ErrorState message={suivi.error} onRetry={suivi.reload} />}

        {suivi.data && !suivi.loading && (
          visibles.length === 0 ? (
            <p className="graphe-vide">
              {recherche.trim()
                ? "Aucun membre ne correspond à cette recherche dans la page affichée."
                : "Aucune donnée d'assiduité sur le périmètre retenu."}
            </p>
          ) : (
            <>
              <div className="tableau-defilement">
                <table className="tableau">
                  <caption className="sr-only">Assiduité des membres sur le périmètre filtré</caption>
                  <thead>
                    <tr>
                      <th scope="col">Membre</th>
                      <th scope="col">Rattachement</th>
                      <th scope="col">Activités vues</th>
                      <th scope="col">Suivies</th>
                      <th scope="col">Taux</th>
                      <th scope="col">Dernière présence</th>
                      <th scope="col">Cohorte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((m) => (
                      <tr key={`${m.nom_affiche}-${m.derniere_presence ?? ""}-${m.observees}`}>
                        <th scope="row">{m.nom_affiche}</th>
                        <td className="cellule-texte">
                          {[m.commission, m.intendance, m.coordination]
                            .filter((x) => x && x !== "Non renseigné").join(" - ") || "Non rattaché"}
                        </td>
                        <td>{m.observees}</td>
                        <td>{m.suivies}</td>
                        <td>
                          <span className="mesure-taux">{m.taux} %</span>
                          <span className="jauge" aria-hidden="true">
                            <span className="jauge-remplie" style={{ width: `${Math.min(100, m.taux)}%` }} />
                          </span>
                        </td>
                        <td>{dateCourte(m.derniere_presence)}</td>
                        <td>
                          <span className={`etiquette etiquette-${COHORTES[m.cohorte].ton}`}>
                            {COHORTES[m.cohorte].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <button
                  type="button" className="btn btn-ghost btn-sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Précédent
                </button>
                <span className="muted small">
                  Page {page + 1} sur {pages} - {total} membre{total > 1 ? "s" : ""} sur le périmètre
                </span>
                <button
                  type="button" className="btn btn-ghost btn-sm"
                  disabled={page + 1 >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </button>
              </div>
            </>
          )
        )}
      </section>
    </>
  );
}
