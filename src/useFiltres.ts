// The screen's filter set, held in the URL rather than in memory.
//
// In the URL because that is what makes a filtered view shareable: a leader who has
// narrowed to their coordination over the last quarter can send that link to
// somebody and they see the same figures. Held in memory, the link is a lie, and the
// back button silently changes the numbers under a heading that did not move.

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Filtres } from "./directionApi.js";

const CLES: (keyof Filtres)[] = [
  "coordination", "intendance", "commission", "tribu", "volet",
  "evenement", "pays", "genre", "type_membre", "depuis", "jusqu_a",
];

function lireHash(): { chemin: string; filtres: Filtres } {
  const brut = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#/, "");
  const [chemin, requete] = brut.split("?");
  const p = new URLSearchParams(requete ?? "");
  const filtres: Filtres = {};
  CLES.forEach((k) => {
    const v = p.get(k);
    if (v) filtres[k] = v;
  });
  return { chemin: chemin || "/overview", filtres };
}

function ecrireHash(chemin: string, filtres: Filtres): void {
  const p = new URLSearchParams();
  CLES.forEach((k) => {
    const v = filtres[k];
    if (v) p.set(k, v);
  });
  const q = p.toString();
  const cible = `#${chemin}${q ? `?${q}` : ""}`;
  if (window.location.hash !== cible) window.location.hash = cible;
}

export interface EtatFiltres {
  filtres: Filtres;
  definir: (cle: keyof Filtres, valeur: string | undefined) => void;
  remplacer: (f: Filtres) => void;
  reinitialiser: () => void;
  actifs: number;
}

export function useFiltres(): EtatFiltres {
  const [filtres, setFiltres] = useState<Filtres>(() => lireHash().filtres);

  // The hash is the source of truth, so a back button, a pasted link and a click on
  // a drill-down all arrive through the same door.
  useEffect(() => {
    const onHash = () => setFiltres(lireHash().filtres);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const remplacer = useCallback((f: Filtres) => {
    ecrireHash(lireHash().chemin, f);
    setFiltres(f);
  }, []);

  const definir = useCallback((cle: keyof Filtres, valeur: string | undefined) => {
    const courant = lireHash().filtres;
    const suivant: Filtres = { ...courant };
    if (valeur) suivant[cle] = valeur;
    else delete suivant[cle];
    // Narrowing to a coordination clears the stewardship and commission chosen inside
    // the previous one: keeping them would filter on a unit that is not in the new
    // scope and silently return nothing, which reads as "no attendance here".
    if (cle === "coordination") {
      delete suivant.intendance;
      delete suivant.commission;
    }
    if (cle === "intendance") delete suivant.commission;
    remplacer(suivant);
  }, [remplacer]);

  const reinitialiser = useCallback(() => remplacer({}), [remplacer]);

  const actifs = useMemo(
    () => CLES.filter((k) => filtres[k]).length,
    [filtres],
  );

  return { filtres, definir, remplacer, reinitialiser, actifs };
}

/** Preset periods, computed against the browser clock at call time. */
export function periodes(): { cle: string; label: string; depuis?: string; jusqu_a?: string }[] {
  const maintenant = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const ilYA = (jours: number) => {
    const d = new Date(maintenant);
    d.setDate(d.getDate() - jours);
    return iso(d);
  };
  const debutAnnee = new Date(maintenant.getFullYear(), 0, 1);
  return [
    { cle: "tout", label: "Tout l'historique" },
    { cle: "30j", label: "30 derniers jours", depuis: ilYA(30) },
    { cle: "90j", label: "90 derniers jours", depuis: ilYA(90) },
    { cle: "12m", label: "12 derniers mois", depuis: ilYA(365) },
    { cle: "annee", label: "Année en cours", depuis: iso(debutAnnee) },
  ];
}
