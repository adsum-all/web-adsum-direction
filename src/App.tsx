import { useCallback, useEffect, useState } from "react";

import { ApiError, type Session, getParticipationGlobal, getStatistiques } from "./api.js";
import { BarChart, DonutChart, LineChart, StackedBar, type ChartDatum } from "./components/Charts.js";
import { Login } from "./components/Login.js";
import { useMarque } from "./useMarque.js";
import { useResource } from "./useResource.js";

// Persist the session across reloads so a refresh no longer logs the user out.
// The token stays in localStorage only; every access is guarded for private mode.
const SESSION_KEY = "adsum.dir.token";

function loadSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.token === "string" && parsed.token.length > 0) {
      return { token: parsed.token, role: typeof parsed.role === "string" ? parsed.role : "" };
    }
    return null;
  } catch {
    return null;
  }
}

function saveSession(session: Session): void {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable (private mode): keep the in-memory session only.
  }
}

function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable (private mode): nothing to clear.
  }
}

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const CHEMINEMENT_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  en_accompagnement: "En accompagnement",
  membre_actif: "Membre actif",
  responsable: "Responsable",
  a_relancer: "À relancer",
  en_pause: "En pause",
  ancien_membre: "Ancien membre",
};

function toSeries(rows: { mois: string; total: number }[]): ChartDatum[] {
  return rows.map((r) => {
    const month = Number(r.mois.slice(5, 7)) - 1;
    return { label: MONTHS_FR[month] ?? r.mois, value: r.total };
  });
}

export function App(): JSX.Element {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const onAuth = useCallback((s: Session) => {
    saveSession(s);
    setSession(s);
  }, []);
  const onLogout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  if (!session) {
    return <Login onAuth={onAuth} />;
  }
  return <DirectionDashboard session={session} onLogout={onLogout} />;
}

function DirectionDashboard({ session, onLogout }: { session: Session; onLogout: () => void }): JSX.Element {
  const marque = useMarque();
  // A revoked or expired token surfaces as a 401: clear the session and return
  // to the login screen cleanly, without a reload loop.
  const onExpired = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        onLogout();
      }
    },
    [onLogout],
  );
  const { data, loading, error, reload } = useResource(
    () => getStatistiques(session.token),
    [session.token],
    onExpired,
  );
  const participation = useResource(() => getParticipationGlobal(session.token), [session.token], onExpired);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Live view: consolidated figures refresh on their own every minute.
  useEffect(() => {
    const timer = window.setInterval(() => {
      reload();
      participation.reload();
      setLastUpdate(new Date());
    }, 60000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token]);

  const entries = data ? toSeries(data.entrees_mensuelles) : [];
  const tauxVerif = data && data.membres_total > 0 ? Math.round((data.membres_verifies / data.membres_total) * 100) : 0;

  return (
    <div className="main">
      <header className="topbar-app">
        <div className="brand">
          <span className="brand-logo" aria-hidden="true">
            {marque.initiale}
          </span>
          <span className="brand-text">
            {marque.marque}
            <span className="brand-sub">Direction</span>
          </span>
        </div>
        <span className="event-chip" title="Lecture seule">
          <span className="event-dot" aria-hidden="true" />
          Vue consolidée, lecture seule
        </span>
        <button type="button" className="link" onClick={onLogout}>
          Déconnexion
        </button>
      </header>

      <div className="main-scroll">
        <div className="page">
          <header className="page-head">
            <div>
              <h1>Pilotage de la direction</h1>
              <p className="muted">Indicateurs consolidés, sur les données réelles de {marque.organisation}.</p>
            </div>
            <span className="event-chip" title="Actualisation automatique toutes les 60 secondes">
              <span className="event-dot" aria-hidden="true" />
              En direct{lastUpdate ? ` · ${lastUpdate.toLocaleTimeString("fr-FR")}` : ""}
            </span>
          </header>

          {error && <p className="banner banner-error">{error}</p>}

          <div className="kpi-grid">
            <Kpi label="Membres" value={data?.membres_total} hint={`${data?.membres_actifs ?? 0} actifs`} loading={loading} accent />
            <Kpi label="Taux de vérification" value={tauxVerif} suffix="%" hint={`${data?.membres_en_attente ?? 0} en attente`} loading={loading} />
            <Kpi label="Présences cumulées" value={data?.presences_total} hint={`${data?.evenements_total ?? 0} événements`} loading={loading} />
            <Kpi label="Commissions" value={data?.commissions_total} hint={`${data?.intendances_total ?? 0} intendances`} loading={loading} />
          </div>

          <div className="card-grid-2">
            <section className="card">
              <h2 className="card-title">Tendance des entrées, 12 derniers mois</h2>
              {loading ? <p className="muted">Chargement...</p> : <LineChart points={entries} />}
            </section>
            <section className="card">
              <h2 className="card-title">Vérification d'identité</h2>
              {loading || !data ? (
                <p className="muted">Chargement...</p>
              ) : (
                <DonutChart
                  centerLabel="membres"
                  segments={[
                    { label: "Vérifiés", value: data.membres_verifies },
                    { label: "En attente", value: data.membres_en_attente },
                  ]}
                />
              )}
            </section>
          </div>


          <section className="card">
            <h2 className="card-title">Présence par activité (récentes)</h2>
            <p className="muted" style={{ marginTop: 0 }}>Répartition présents / partiels / absents des dernières activités.</p>
            {participation.loading ? (
              <p className="muted">Chargement...</p>
            ) : (participation.data?.serie_evenements ?? []).length === 0 ? (
              <p className="muted">Aucune activité avec présence enregistrée pour le moment.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(participation.data?.serie_evenements ?? []).slice(0, 5).map((ev) => (
                  <div key={ev.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{ev.titre}</span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {ev.presents} présents · {ev.partiels} partiels · {ev.absents} absents
                      </span>
                    </div>
                    <StackedBar presents={ev.presents} partiels={ev.partiels} absents={ev.absents} />
                  </div>
                ))}
              </div>
            )}
          </section>
          <div className="card-grid-2">
            <section className="card">
              <h2 className="card-title">Répartition par cheminement pastoral</h2>
              {loading || !data ? (
                <p className="muted">Chargement...</p>
              ) : (
                <DonutChart
                  centerLabel="membres"
                  segments={data.par_cheminement.map((r) => ({
                    label: CHEMINEMENT_LABELS[r.cheminement] ?? r.cheminement ?? "-",
                    value: r.total,
                  }))}
                />
              )}
            </section>
            <section className="card">
              <h2 className="card-title">Comparaison par commission / mission</h2>
              {loading || !data ? (
                <p className="muted">Chargement...</p>
              ) : (
                <BarChart items={data.par_commission.map((r) => ({ label: r.commission ?? "Sans", value: r.total }))} />
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

interface KpiProps {
  label: string;
  value: number | undefined;
  hint: string;
  loading: boolean;
  accent?: boolean;
  suffix?: string;
}

function Kpi({ label, value, hint, loading, accent, suffix }: KpiProps): JSX.Element {
  return (
    <div className={`kpi ${accent ? "kpi-accent" : ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">
        {loading || value === undefined ? "..." : `${value.toLocaleString("fr-FR")}${suffix ?? ""}`}
      </span>
      <span className="kpi-hint">{hint}</span>
    </div>
  );
}
