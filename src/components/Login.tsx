import { useState } from "react";

import { ApiError, type Session, getMesPermissions, login, loginVerify } from "../api.js";
import { useMarque } from "../useMarque.js";

interface LoginProps {
  onAuth: (session: Session) => void;
}

// Access is gated by permission, not a hard-coded role: any account the admin team
// granted the direction read access (statistiques.consulter, via a role or a group)
// may sign in. The server still enforces every endpoint.
const REQUISE = "statistiques.consulter";

export function Login({ onAuth }: LoginProps): JSX.Element {
  const marque = useMarque();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [faireConfiance, setFaireConfiance] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [canal, setCanal] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function finaliser(session: Session): Promise<void> {
    const perms = await getMesPermissions(session.token);
    if (!perms.includes(REQUISE)) {
      setError("Votre compte n'a pas encore accès à la direction. Contactez l'administration.");
      return;
    }
    onAuth(session);
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (otpRequired) {
        await finaliser(await loginVerify(email, password, code.trim(), faireConfiance));
        return;
      }
      const result = await login(email, password);
      if (result.otpRequired) {
        setOtpRequired(true);
        setCanal(result.canal);
        return;
      }
      if (result.session) await finaliser(result.session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form onSubmit={submit} className="auth-card">
        <div className="brand brand-lg">
          <span className="brand-logo" aria-hidden="true">{marque.initiale}</span>
          <span className="brand-text">
            {marque.marque}
            <span className="brand-sub">Direction</span>
          </span>
        </div>

        {!otpRequired && (
          <>
            <label>
              <span>Courriel</span>
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              <span>Mot de passe</span>
              <span className="pw-field">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  aria-pressed={showPassword}
                  title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.6 9.6 0 0112 5c5 0 9 4.5 10 7a13.2 13.2 0 01-2.9 3.9M6.1 6.1C3.8 7.5 2.3 9.6 2 12c1 2.5 5 7 10 7a9.8 9.8 0 004.1-.9"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  )}
                </button>
              </span>
            </label>
          </>
        )}

        {otpRequired && (
          <>
            <p className="muted small">
              Un code de vérification vous a été envoyé{canal === "telegram" ? " sur Telegram" : " par courriel"}. Saisissez-le pour continuer.
            </p>
            <label>
              <span>Code de vérification</span>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={faireConfiance} onChange={(e) => setFaireConfiance(e.target.checked)} />
              <span className="small">Faire confiance à cet appareil pendant 30 jours</span>
            </label>
          </>
        )}

        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Connexion..." : otpRequired ? "Valider le code" : "Se connecter"}
        </button>
        <p className="muted small center">Vue consolidée, lecture seule.</p>
      </form>
    </div>
  );
}
