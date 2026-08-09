// Client for the direction's analytical endpoints.
//
// Every call takes the same filter object and appends it the same way, so a screen
// cannot end up with one panel filtered and another not. That is a correctness
// property, not a convenience: a dashboard headed "third quarter" showing one chart
// of the whole year misleads more than a dashboard with no filters at all.

import { ApiError, apiBaseUrl } from "./api.js";

export interface Filtres {
  coordination?: string;
  intendance?: string;
  commission?: string;
  tribu?: string;
  volet?: string;
  evenement?: string;
  pays?: string;
  genre?: string;
  type_membre?: string;
  depuis?: string;
  jusqu_a?: string;
}

export interface Dimension { cle: string; libelle: string; famille: "membre" | "activite" | string }

export interface Catalogue {
  dimensions: Dimension[];
  filtres: string[];
  mesures: string[];
}

export interface Synthese {
  observations: number;
  activites: number;
  membres_vus: number;
  membres_actifs: number;
  /** On site. The word "présence" means this axis and nothing else: somebody who
   *  followed online followed, they were not present. */
  presents: number;
  presentiel: number;
  /** Followed online without coming. presentiel + en_ligne + inconnu = suivis. */
  en_ligne: number;
  partiels: number;
  absents: number;
  scannes: number;
  /** People who followed, however they followed. The five buckets below sum to it. */
  suivis: number;
  presentiel_prouve: number;
  presentiel_declare: number;
  en_ligne_complet: number;
  en_ligne_partiel: number;
  suivi_modalite_inconnue: number;
  /** Rows the old model cannot express. Excluded from every rate, counted here so
   *  the exclusion is visible rather than silent. */
  non_interpretables: number;
  /** Share of the expected who came on site. Always below taux_suivi, which contains it. */
  taux_presence: number;
  taux_presence_physique: number;
  /** Share of the expected who followed, by any channel. */
  taux_suivi: number;
  taux_participation: number;
  /** Share of the attendance that is evidence rather than assertion. */
  taux_preuve: number;
  taux_couverture: number;
  moyenne_par_activite: number;
}

export interface LigneRepartition {
  label: string;
  /** Followed, by any channel. suivis + absents = total. */
  suivis: number;
  presents: number;
  partiels: number;
  absents: number;
  /** Denominator of every rate here: excludes the uninterpretable rows. */
  total: number;
  /** What the base actually holds, so a group made only of such rows is not empty. */
  lignes: number;
  presentiel: number;
  en_ligne: number;
  scannes: number;
  presentiel_prouve: number;
  presentiel_declare: number;
  en_ligne_complet: number;
  en_ligne_partiel: number;
  suivi_modalite_inconnue: number;
  non_interpretables: number;
  en_ligne_sans_degre: number;
  taux_presence: number;
  taux_presence_physique: number;
  taux_suivi: number;
  taux_participation: number;
  taux_a_distance: number;
  taux_absence: number;
  taux_preuve: number;
}

export interface Noeud extends LigneRepartition {
  niveau: "coordination" | "intendance" | "commission";
  membres: number;
  enfants?: Noeud[];
}

export interface PointSerie {
  evenement_id: string;
  titre: string;
  date: string | null;
  volet: string;
  /** Followed, by any channel. presentiel + en_ligne + canal_inconnu = suivis. */
  suivis: number;
  /** On site. This, and only this, is what "présence" means. */
  presentiel: number;
  /** Followed online without coming. The gap between the two curves is exactly this. */
  en_ligne: number;
  canal_inconnu: number;
  /** Alias of presentiel, kept while the screens migrate. */
  presents: number;
  partiels: number;
  absents: number;
  total: number;
  scannes: number;
  taux_presence: number;
  taux_suivi: number;
  taux_participation: number;
}

export interface Assiduite {
  cohortes: { cle: string; label: string; membres: number; part: number }[];
  membres_classes: number;
  membres_donnees_insuffisantes: number;
  taux_moyen: number;
  taux_median: number;
}

export interface SuiviMembre {
  nom_affiche: string;
  coordination: string;
  intendance: string;
  commission: string;
  tribu: string;
  observees: number;
  suivies: number;
  taux: number;
  derniere_presence: string | null;
  cohorte: "assidu" | "regulier" | "irregulier" | "decroche" | "donnees_insuffisantes";
}

export interface SuiviMembres {
  membres: SuiviMembre[];
  total: number;
  limite: number;
  decalage: number;
  /** The whitelist the server honoured. Displayed on the page so the minimisation
   *  claim is verifiable by the reader rather than merely asserted in a document. */
  champs_exposes: string[];
}

/** Turn the filter object into a query string, dropping what is not set. */
export function versQuery(filtres: Filtres, extra: Record<string, string | number | undefined> = {}): string {
  const p = new URLSearchParams();
  Object.entries({ ...filtres, ...extra }).forEach(([k, v]) => {
    if (v !== undefined && v !== null && `${v}` !== "") p.set(k, `${v}`);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function lire<T>(token: string, chemin: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${chemin}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    // The server names the accepted dimensions and filters on a 422. Passing that
    // through instead of a generic message is what lets somebody fix a bad link
    // rather than merely learn that it failed.
    let detail = "";
    try {
      const corps = (await res.json()) as { detail?: string };
      detail = typeof corps.detail === "string" ? corps.detail : "";
    } catch {
      detail = "";
    }
    const message =
      res.status === 401 ? "Session expirée"
        : res.status === 403 ? "Accès refusé"
          : res.status === 422 ? (detail || "Paramètre non reconnu")
            : detail || "Données indisponibles";
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

const D = "/api/v1/direction";

export const getCatalogue = (t: string) => lire<Catalogue>(t, `${D}/dimensions`);

export const getSynthese = (t: string, f: Filtres) => lire<Synthese>(t, `${D}/synthese${versQuery(f)}`);

export const getRepartition = (t: string, f: Filtres, dimension: string) =>
  lire<LigneRepartition[]>(t, `${D}/repartition${versQuery(f, { dimension })}`);

export const getCroisement = (t: string, f: Filtres, lignes: string, colonnes: string, mesure = "presents") =>
  lire<import("./charts/CrossTab.js").Croisement>(t, `${D}/croisement${versQuery(f, { lignes, colonnes, mesure })}`);

export const getArborescence = (t: string, f: Filtres) => lire<Noeud[]>(t, `${D}/arborescence${versQuery(f)}`);

export const getSerie = (t: string, f: Filtres) => lire<PointSerie[]>(t, `${D}/serie${versQuery(f)}`);

export const getAssiduite = (t: string, f: Filtres) => lire<Assiduite>(t, `${D}/assiduite${versQuery(f)}`);

export const getSuiviMembres = (
  t: string, f: Filtres, opts: { tri?: string; limite?: number; decalage?: number } = {},
) => lire<SuiviMembres>(t, `${D}/suivi-membres${versQuery(f, opts)}`);

// --- Hierarchy, served by endpoints that already existed --------------------

export interface OrganigrammeNoeud {
  id: string;
  cle?: string | null;
  type_noeud?: string | null;
  nom?: string | null;
  sous_titre?: string | null;
  /** Refreshed from the member record; the node's own `nom` is a label cached when
   *  the version was published and can lag behind a rename. */
  membre_nom?: string | null;
  categorie?: string | null;
  unite_type?: string | null;
  effectif?: number | null;
  statut?: string | null;
  [k: string]: unknown;
}

export interface OrganigrammeLien {
  id: string;
  source_id: string;
  cible_id: string;
  type_lien?: string | null;
  libelle?: string | null;
}

export interface OrganigrammePublie {
  version: { id: string; libelle: string; publie_le?: string | null } | null;
  noeuds: OrganigrammeNoeud[];
  liens: OrganigrammeLien[];
}

export const getOrganigrammePublie = (t: string) =>
  lire<OrganigrammePublie>(t, "/api/v1/organigramme/publie");

export const getMaHierarchie = (t: string) =>
  lire<Record<string, unknown>>(t, "/api/v1/membres/me/hierarchie");

// --- The connected account --------------------------------------------------

export interface Compte {
  id: string;
  email: string;
  role: string;
  membre_id: string | null;
  session_id: string | null;
  acces_technique_global?: boolean;
  niveau_technique?: string | null;
}

export const getCompte = (t: string) => lire<Compte>(t, "/api/v1/auth/me");

export interface Connexion {
  id?: string;
  appareil?: string | null;
  navigateur?: string | null;
  ip?: string | null;
  derniere_activite?: string | null;
  courante?: boolean;
  [k: string]: unknown;
}

export const getMesConnexions = (t: string) =>
  lire<Connexion[]>(t, "/api/v1/membres/me/connexions");

/** Arrival times actually recorded for one activity, bucketed by quarter hour.
 *
 * `disponible` is false when the recorded times carry no spread; `motif` then says why,
 * and the screen states it instead of drawing a curve over a single instant.
 */
export interface Arrivees {
  disponible: boolean;
  motif: string | null;
  total?: number;
  tranches: { minutes: number; libelle: string; arrivees: number; cumul: number; part_cumulee: number }[];
}

export function getArrivees(token: string, evenementId: string): Promise<Arrivees> {
  return lire<Arrivees>(token, `/api/v1/direction/activites/${evenementId}/arrivees`);
}
