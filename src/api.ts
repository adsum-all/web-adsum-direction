// Thin read-only client for the ADSUM API, used by the direction dashboard.
// The direction role has read access to the aggregated statistics endpoint.

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "https://adsum-api.vercel.app";

export type Role = "direction" | "admin" | "super_admin" | string;

export interface Session {
  token: string;
  role: Role;
}

export interface Statistiques {
  membres_total: number;
  membres_actifs: number;
  membres_verifies: number;
  membres_en_attente: number;
  evenements_total: number;
  presences_total: number;
  commissions_total: number;
  missions_total: number;
  intendances_total: number;
  par_commission: { commission: string; total: number }[];
  par_cheminement: { cheminement: string; total: number }[];
  entrees_mensuelles: { mois: string; total: number }[];
  membres_a_verifier: { id: string; matricule: string; prenoms: string | null; nom: string | null }[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function deviceId(): string {
  if (typeof localStorage === "undefined") return "";
  let id = localStorage.getItem("adsum.device.id");
  if (!id) {
    id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("adsum.device.id", id);
  }
  return id;
}

export interface LoginResult {
  otpRequired: boolean;
  session: Session | null;
  canal: string | null;
  /** Why the mailbox refused our last messages, when it did. Null otherwise. */
  alerteEmail: string | null;
}

function loginError(status: number): ApiError {
  if (status === 401) return new ApiError("Identifiants invalides ou mot de passe temporaire expiré", status);
  if (status === 429) return new ApiError("Trop de tentatives. Patientez quelques minutes, puis réessayez.", status);
  if (status === 400) return new ApiError("Code incorrect ou expiré. Vérifiez et réessayez.", status);
  return new ApiError("Service momentanément indisponible.", status);
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Device-Id": deviceId() },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw loginError(res.status);
  const data = (await res.json()) as { otp_required?: boolean; access_token?: string | null; role?: Role; canal?: string | null; alerte_email?: string | null };
  return {
    otpRequired: Boolean(data.otp_required),
    session: data.access_token ? { token: data.access_token, role: data.role ?? "" } : null,
    canal: data.canal ?? null,
    alerteEmail: data.alerte_email ?? null,
  };
}

export async function loginVerify(email: string, password: string, code: string, faireConfiance: boolean): Promise<Session> {
  const res = await fetch(`${BASE}/api/v1/auth/login-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Device-Id": deviceId() },
    body: JSON.stringify({ email, password, code, faire_confiance: faireConfiance }),
  });
  if (!res.ok) throw loginError(res.status);
  const data = (await res.json()) as { access_token?: string | null; role?: Role };
  if (!data.access_token) throw loginError(401);
  return { token: data.access_token, role: data.role ?? "" };
}

export async function getMesPermissions(token: string): Promise<string[]> {
  const res = await fetch(`${BASE}/api/v1/membres/me/permissions`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ApiError("Impossible de vérifier vos accès", res.status);
  const data = (await res.json()) as { permissions?: string[] };
  return data.permissions ?? [];
}

export async function getStatistiques(token: string): Promise<Statistiques> {
  const res = await fetch(`${BASE}/api/v1/admin/statistiques`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const message =
      res.status === 401 ? "Session expirée" : res.status === 403 ? "Accès refusé" : "Statistiques indisponibles";
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as Statistiques;
}

export function apiBaseUrl(): string {
  return BASE;
}

export interface ParticipationGlobal {
  nb_evenements: number;
  repartition_globale: { presents: number; partiels: number; absents: number; presentiel: number; en_ligne: number };
  serie_evenements: { id: string; titre: string; debut: string | null; volet: string; presents: number; partiels: number; absents: number }[];
}

export async function getParticipationGlobal(token: string): Promise<ParticipationGlobal> {
  const res = await fetch(`${BASE}/api/v1/admin/participation/global`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const message =
      res.status === 401 ? "Session expirée" : res.status === 403 ? "Accès refusé" : "Participation indisponible";
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as ParticipationGlobal;
}
