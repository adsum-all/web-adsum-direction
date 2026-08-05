// Profil de l'utilisateur connecté.

import { PageHeader } from "../components/PageHeader.js";
import { useDirection } from "../DirectionContext.js";

export function ProfilePage(): JSX.Element {
  const { session, onLogout, lastUpdate } = useDirection();
  const maskedToken = session.token.length > 12
    ? `${session.token.slice(0, 6)}…${session.token.slice(-4)}`
    : "•••";

  return (
    <>
      <PageHeader
        eyebrow="Compte"
        title="Mon profil"
        description="Informations de session et préférences pour l'utilisateur connecté à ADSUM Direction."
      />

      <div className="card profile-card">
        <div className="profile-avatar" aria-hidden="true">
          {(session.role || "D").slice(0, 1).toUpperCase()}
        </div>
        <div className="profile-body">
          <p className="profile-role">{session.role || "direction"}</p>
          <p className="muted small">Rôle actif · lecture seule</p>
        </div>
      </div>

      <div className="card">
        <div className="section-head"><div className="section-title-row"><h2>Session</h2></div></div>
        <dl className="profile-dl">
          <div><dt>Jeton d'accès</dt><dd className="mono">{maskedToken}</dd></div>
          <div><dt>Dernière synchronisation</dt><dd>{lastUpdate ? lastUpdate.toLocaleString("fr-FR") : "—"}</dd></div>
          <div><dt>Périmètre</dt><dd>Consolidé — Sacerdoce Royal</dd></div>
        </dl>
        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-ghost btn-inline" onClick={onLogout}>
            Se déconnecter
          </button>
        </div>
      </div>

      <div className="card">
        <div className="section-head"><div className="section-title-row"><h2>Sécurité et confidentialité</h2></div></div>
        <p className="muted small">
          L'application Direction agit en lecture seule sur des indicateurs consolidés.
          Les informations sensibles individuelles ne sont ni affichées ni exportées.
        </p>
      </div>
    </>
  );
}
