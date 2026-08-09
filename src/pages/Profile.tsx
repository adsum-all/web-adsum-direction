// The connected account: who you are here, what you may read, where you sit.
//
// The page used to show a role, a masked token and a hard-coded organisation name.
// The token is not information anybody can act on, and the hard-coded name was a
// defect in a platform sold to several organisations: a second client would have read
// somebody else's identity on their own profile screen.
//
// So it is rebuilt from what the server actually says: the account, the permissions
// it holds, its place in the published hierarchy, and its open sessions. Permissions
// are listed because in this platform they are not a formality: they decide whether
// the nominative follow-up is reachable at all, and somebody who cannot see a page
// deserves to know why rather than to find a menu entry missing.

import { useMemo } from "react";

import { getMesPermissions } from "../api.js";
import { PageHeader } from "../components/PageHeader.js";
import { ErrorState, SkeletonBlock } from "../components/States.js";
import { useDirection } from "../DirectionContext.js";
import { getCompte, getMaHierarchie, getMesConnexions } from "../directionApi.js";
import { useMarque } from "../useMarque.js";
import { useResource } from "../useResource.js";

/** Permissions that decide what this application shows, and what each one unlocks. */
const CLES_DIRECTION: { cle: string; effet: string }[] = [
  { cle: "statistiques.consulter", effet: "Accès aux tableaux de bord, croisements et exports." },
  { cle: "membres.consulter", effet: "Accès au suivi nominatif des membres." },
  { cle: "participation.consulter", effet: "Accès à la participation consolidée." },
  { cle: "organisation.consulter", effet: "Accès à l'organigramme publié." },
  { cle: "evenements.consulter", effet: "Accès au calendrier et au détail des activités." },
];

function dateLisible(v: unknown): string {
  if (typeof v !== "string" || !v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "-"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function ProfilePage(): JSX.Element {
  const { session, onLogout, lastUpdate } = useDirection();
  const marque = useMarque();
  const jeton = session.token;

  const compte = useResource(() => getCompte(jeton), [jeton]);
  const permissions = useResource(() => getMesPermissions(jeton), [jeton]);
  // A direction account is often a service account with no member record, and the
  // hierarchy endpoint answers 403 in that case. That is a normal state, not a
  // failure, so it resolves to null rather than painting an error on the profile.
  const hierarchie = useResource(() => getMaHierarchie(jeton).catch(() => null), [jeton]);
  const connexions = useResource(() => getMesConnexions(jeton).catch(() => null), [jeton]);

  const detenues = useMemo(() => new Set(permissions.data ?? []), [permissions.data]);

  const fonctions = useMemo(() => {
    const h = hierarchie.data as { fonctions?: { libelle?: string; unite?: string }[] } | null;
    return Array.isArray(h?.fonctions) ? h.fonctions : [];
  }, [hierarchie.data]);

  const superieurs = useMemo(() => {
    const h = hierarchie.data as { chaine?: { libelle?: string; titulaire?: string }[] } | null;
    return Array.isArray(h?.chaine) ? h.chaine : [];
  }, [hierarchie.data]);

  return (
    <>
      <PageHeader
        eyebrow="Compte"
        title="Mon profil"
        description={`Votre compte, vos droits et votre place dans ${marque.organisation}.`}
      />

      <div className="card profile-card">
        <div className="profile-avatar" aria-hidden="true">
          {(compte.data?.email ?? session.role ?? "D").slice(0, 1).toUpperCase()}
        </div>
        <div className="profile-body">
          <p className="profile-role">{compte.data?.email ?? "Compte en cours de chargement"}</p>
          <p className="muted small">
            Rôle <strong>{compte.data?.role ?? session.role ?? "direction"}</strong>
            {" - "}lecture seule sur {marque.organisation}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="section-head"><div className="section-title-row"><h2>Ce que vous pouvez consulter</h2></div></div>
        {permissions.loading && <SkeletonBlock height={80} />}
        {permissions.error && !permissions.loading && (
          <ErrorState message={permissions.error} onRetry={permissions.reload} />
        )}
        {permissions.data && !permissions.loading && (
          <>
            <ul className="droits">
              {CLES_DIRECTION.map((p) => {
                const ok = detenues.has(p.cle);
                return (
                  <li key={p.cle} className={ok ? "" : "est-refuse"}>
                    <span className={`etiquette etiquette-${ok ? "ok" : "neutre"}`}>
                      {ok ? "Accordé" : "Non accordé"}
                    </span>
                    <span className="droits-cle">{p.cle}</span>
                    <span className="muted small">{p.effet}</span>
                  </li>
                );
              })}
            </ul>
            <p className="muted small">
              {detenues.size} permission{detenues.size > 1 ? "s" : ""} au total sur la plateforme.
              Les droits se règlent depuis le back-office : cette application ne les modifie jamais.
            </p>
          </>
        )}
      </div>

      <div className="card">
        <div className="section-head"><div className="section-title-row"><h2>Ma place dans la hiérarchie</h2></div></div>
        {hierarchie.loading && <SkeletonBlock height={60} />}
        {!hierarchie.loading && hierarchie.data === null && (
          <p className="muted small">
            Ce compte n'est pas rattaché à une fiche membre : il n'apparaît donc pas dans l'organigramme.
            C'est le cas normal d'un compte de service. L'organigramme complet reste consultable
            depuis la page Hiérarchie.
          </p>
        )}
        {!hierarchie.loading && hierarchie.data !== null && (
          <>
            {fonctions.length > 0 ? (
              <ul className="droits">
                {fonctions.map((f, i) => (
                  <li key={i}>
                    <span className="etiquette etiquette-info">Fonction</span>
                    <span className="droits-cle">{f.libelle ?? "Fonction"}</span>
                    <span className="muted small">{f.unite ?? ""}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Aucune fonction active enregistrée pour ce compte.</p>
            )}
            {superieurs.length > 0 && (
              <p className="muted small">
                Chaîne hiérarchique : {superieurs.map((n) => n.libelle ?? n.titulaire ?? "?").join(" > ")}
              </p>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="section-head"><div className="section-title-row"><h2>Session et appareils</h2></div></div>
        <dl className="profile-dl">
          <div><dt>Identifiant du compte</dt><dd className="mono">{compte.data?.id ?? "-"}</dd></div>
          <div><dt>Dernière synchronisation</dt><dd>{lastUpdate ? lastUpdate.toLocaleString("fr-FR") : "-"}</dd></div>
          <div><dt>Périmètre de lecture</dt><dd>Consolidé - {marque.organisation}</dd></div>
        </dl>
        {Array.isArray(connexions.data) && connexions.data.length > 0 && (
          <div className="tableau-defilement" style={{ marginTop: 14 }}>
            <table className="tableau">
              <caption className="sr-only">Sessions ouvertes sur ce compte</caption>
              <thead>
                <tr>
                  <th scope="col">Appareil</th>
                  <th scope="col">Navigateur</th>
                  <th scope="col">Dernière activité</th>
                </tr>
              </thead>
              <tbody>
                {connexions.data.slice(0, 8).map((c, i) => (
                  <tr key={c.id ?? i}>
                    <th scope="row">
                      {(c.appareil as string) ?? "Appareil inconnu"}
                      {c.courante && <span className="etiquette etiquette-ok" style={{ marginLeft: 8 }}>Session actuelle</span>}
                    </th>
                    <td className="cellule-texte">{(c.navigateur as string) ?? "-"}</td>
                    <td>{dateLisible(c.derniere_activite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-ghost btn-inline" onClick={onLogout}>
            Se déconnecter
          </button>
        </div>
      </div>

      <div className="card">
        <div className="section-head"><div className="section-title-row"><h2>Confidentialité</h2></div></div>
        <p className="muted small">
          Cette application travaille sur des indicateurs consolidés. La seule page nominative,
          le suivi des membres, se limite au nom, au rattachement et aux chiffres d'assiduité :
          ni coordonnées, ni adresse, ni document, ni photographie. Le serveur transmet la liste
          des champs qu'il a retenus, affichée en haut de cette page, pour que la restriction soit
          vérifiable et pas seulement annoncée.
        </p>
      </div>
    </>
  );
}
