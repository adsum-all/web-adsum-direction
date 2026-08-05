// Référentiel officiel des modalités transverses (commissions, tribus,
// coordinations, intendances, événements récurrents). Source : document
// GROUPE_COMM_TRIBU_INT_etc.docx fourni par la direction.
//
// Utilisé pour normaliser l'affichage des libellés, alimenter les filtres et
// enrichir les répartitions lorsque l'API ne fournit qu'une clé brute.

export const COMMISSIONS_MISSIONS = [
  "Chœur Kerubim",
  "CUJM",
  "Eden",
  "El Gibhor",
  "Jean Baptiste",
  "Joseph d'Arimathie",
  "Marie de Magdala",
  "Néhémie",
  "Saint François",
  "Saint Gabriel",
  "STEJ",
  "Timothée",
  "Tribu de David",
  "Vaillants Héros",
  "Mission des hommes et femmes d'affaires",
] as const;

export const TRIBUS = [
  "Asher", "Zabulon", "Nephtali", "Levi", "Gad", "Issacar",
  "Dan", "Joseph", "Benjamin", "Siméon", "Juda", "Ruben",
] as const;

export const COORDINATIONS = ["France", "USA", "Afrique", "Canada", "Europe"] as const;

export const INTENDANCES = [
  "Cocody", "Abobo", "Yopougon Zone 1", "Yopougon Zone 2", "Marcory",
  "Bingerville", "Bassam", "Yamoussoukro et alliés", "Guiglo et l'Ouest",
  "Abengourou et l'Est", "Korhogo et le Nord", "Bouaké", "San Pedro",
  "Agboville et alliés",
] as const;

export const EVENEMENTS_RECURRENTS = [
  "Séminaire",
  "Répétition Chœur Kerubim",
  "Équipe de danse prophétique",
  "École de ministère",
  "14 jours de jeûne et de prière",
  "Prière de révélation",
  "Rencontre des âmes seules",
  "Rencontre des couples",
  "La piscine de Bethesda",
  "Rendez-vous des rois et des reines",
  "21 jours de jeûne et de prière",
  "Intercession communautaire",
  "Recollection",
  "Retraite",
  "Sinaï",
  "Kaïros",
  "KTO",
  "Torrent de Kerith",
] as const;

/** Normalise une clé brute (slug, majuscules, accents) vers un libellé du référentiel. */
export function normalizeLabel(raw: string | null | undefined, ref: readonly string[]): string {
  if (!raw) return "—";
  const norm = raw
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const match = ref.find(
    (r) =>
      r
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase() === norm,
  );
  return match ?? raw;
}
