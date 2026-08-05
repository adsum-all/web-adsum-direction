// French labels shared across pages.

export const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export const CHEMINEMENT_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  en_accompagnement: "En accompagnement",
  membre_actif: "Membre actif",
  responsable: "Responsable",
  a_relancer: "À relancer",
  en_pause: "En pause",
  ancien_membre: "Ancien membre",
};

export function toMonthlyLabel(iso: string): string {
  const m = Number(iso.slice(5, 7)) - 1;
  return MONTHS_FR[m] ?? iso;
}

export function seriesToChart(rows: { mois: string; total: number }[]) {
  return rows.map((r) => ({ label: toMonthlyLabel(r.mois), value: r.total }));
}
