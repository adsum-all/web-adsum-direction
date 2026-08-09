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

// ---------- Référentiels & organisation ----------

async function getJson<T>(token: string, path: string, notFoundFallback: T | null = null): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if ((res.status === 404 || res.status === 403) && notFoundFallback !== null) return notFoundFallback;
  if (!res.ok) {
    const message =
      res.status === 401 ? "Session expirée"
      : res.status === 403 ? "Accès refusé"
      : `Ressource indisponible (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export interface ReferenceItem { id?: string; code?: string; libelle?: string; nom?: string; [k: string]: unknown }
export interface Tribu extends ReferenceItem { patriarche?: string | null; effectif?: number }
export interface Coordination extends ReferenceItem { pays?: string; continent?: string; effectif?: number }
export interface Intendance extends ReferenceItem { ville?: string; region?: string; effectif?: number }
export interface Commission extends ReferenceItem { effectif?: number; sous_commissions?: number }
export interface Pays extends ReferenceItem { code_iso?: string; continent?: string; effectif?: number }

export const listReferenceTribus = (t: string) => getJson<Tribu[]>(t, "/api/v1/reference/tribus", []);
export const listReferenceCommissions = (t: string) => getJson<Commission[]>(t, "/api/v1/reference/commissions", []);
export const listReferenceIntendances = (t: string) => getJson<Intendance[]>(t, "/api/v1/reference/intendances", []);
export const listReferenceCoordinations = (t: string) => getJson<Coordination[]>(t, "/api/v1/reference/coordinations", []);
export const listAdminTribus = (t: string) => getJson<Tribu[]>(t, "/api/v1/admin/tribus", []);
export const listAdminCoordinations = (t: string) => getJson<Coordination[]>(t, "/api/v1/admin/coordinations", []);
export const listAdminIntendances = (t: string) => getJson<Intendance[]>(t, "/api/v1/admin/intendances", []);
export const listAdminCommissions = (t: string) => getJson<Commission[]>(t, "/api/v1/admin/commissions", []);
export const listPays = (t: string) => getJson<Pays[]>(t, "/api/v1/admin/annuaire/pays", []);

// ---------- Événements (calendrier) ----------

export interface Evenement {
  id: string;
  titre: string;
  debut: string | null;
  fin?: string | null;
  type?: string | null;
  volet?: string | null;
  lieu?: string | null;
  statut?: string | null;
  [k: string]: unknown;
}

export async function listEvenements(token: string, params?: { debut?: string; fin?: string }): Promise<Evenement[]> {
  const qs = new URLSearchParams();
  if (params?.debut) qs.set("debut", params.debut);
  if (params?.fin) qs.set("fin", params.fin);
  const suffix = qs.toString() ? `?${qs}` : "";
  const raw = await getJson<Evenement[] | { items?: Evenement[]; evenements?: Evenement[] }>(
    token, `/api/v1/admin/evenements${suffix}`, [],
  );
  if (Array.isArray(raw)) return raw;
  return raw.items ?? raw.evenements ?? [];
}

export interface TypeEvenement { id?: string; code?: string; libelle?: string; couleur?: string | null }
export const listTypesEvenements = (t: string) => getJson<TypeEvenement[]>(t, "/api/v1/reference/types-evenements", []);

// ---------- Répartitions détaillées de participation ----------

export interface EntityBreakdownRow {
  label: string;
  presents: number;
  partiels: number;
  absents: number;
  attendus?: number;
}

export type BreakdownDimension =
  | "commission" | "tribu" | "coordination" | "intendance"
  | "pays" | "continent" | "volet";

async function tryGetJson<T>(token: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) throw new ApiError("Session expirée", 401);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    return null;
  }
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

function normalizeRows(raw: unknown, ...labelKeys: string[]): EntityBreakdownRow[] {
  if (!Array.isArray(raw)) return [];
  const keys = [...labelKeys, "label", "libelle", "nom", "name", "code"];
  return raw
    .map((r: Record<string, unknown>) => {
      const label = keys.map((k) => r?.[k]).find((v) => typeof v === "string" && v) as string | undefined;
      return {
        label: label ?? "-",
        presents: toNum(r?.presents ?? (r as Record<string, unknown>)["present"]),
        partiels: toNum(r?.partiels ?? (r as Record<string, unknown>)["partiel"]),
        absents: toNum(r?.absents ?? (r as Record<string, unknown>)["absent"]),
        attendus: r?.attendus !== undefined ? toNum(r.attendus) : undefined,
      };
    })
    .filter((r) => r.presents + r.partiels + r.absents > 0 || (r.attendus ?? 0) > 0);
}

export interface EvenementStats {
  id: string;
  par_commission: EntityBreakdownRow[];
  par_tribu: EntityBreakdownRow[];
  par_coordination: EntityBreakdownRow[];
  par_intendance: EntityBreakdownRow[];
  par_pays: EntityBreakdownRow[];
  par_continent: EntityBreakdownRow[];
  par_volet: EntityBreakdownRow[];
  hasAny: boolean;
}

export async function getEvenementStats(token: string, id: string): Promise<EvenementStats | null> {
  const raw = await tryGetJson<Record<string, unknown>>(
    token, `/api/v1/admin/evenements/${encodeURIComponent(id)}/participation-stats`,
  );
  if (!raw || typeof raw !== "object") return null;
  const pick = (a: string, b: string, key: string) =>
    normalizeRows((raw[a] ?? raw[b]) as unknown, key);
  const out: EvenementStats = {
    id,
    par_commission: pick("par_commission", "commissions", "commission"),
    par_tribu: pick("par_tribu", "tribus", "tribu"),
    par_coordination: pick("par_coordination", "coordinations", "coordination"),
    par_intendance: pick("par_intendance", "intendances", "intendance"),
    par_pays: pick("par_pays", "pays", "pays"),
    par_continent: pick("par_continent", "continents", "continent"),
    par_volet: pick("par_volet", "volets", "volet"),
    hasAny: false,
  };
  out.hasAny = [out.par_commission, out.par_tribu, out.par_coordination, out.par_intendance, out.par_pays, out.par_continent, out.par_volet]
    .some((rows) => rows.length > 0);
  return out;
}

export async function getParticipationParEntite(
  token: string, dimension: BreakdownDimension, cross?: BreakdownDimension,
): Promise<EntityBreakdownRow[] | null> {
  const qs = new URLSearchParams({ dimension });
  if (cross) qs.set("cross", cross);
  const raw = await tryGetJson<unknown>(token, `/api/v1/admin/participation/par-entite?${qs}`);
  if (raw === null) return null;
  const arr = Array.isArray(raw) ? raw
    : (raw as { items?: unknown[]; rows?: unknown[]; data?: unknown[] }).items
    ?? (raw as { rows?: unknown[] }).rows
    ?? (raw as { data?: unknown[] }).data
    ?? [];
  return normalizeRows(arr, dimension, cross ?? "");
}
