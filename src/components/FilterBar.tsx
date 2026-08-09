// The filter bar that governs every panel on the page.
//
// One bar, applied everywhere, shown as selections rather than typed input: the
// direction picks from what the organisation actually contains, so a filter can
// never name a unit that does not exist and quietly return an empty screen.
//
// The active filters stay visible as removable chips even when the panel is folded.
// A filtered dashboard that does not say it is filtered is how somebody reports a
// coordination's figure as the whole organisation's.

import { useEffect, useMemo, useState } from "react";

import {
  type Commission, type Coordination, type Intendance, type Tribu,
  listAdminCommissions, listAdminCoordinations, listAdminIntendances, listAdminTribus,
} from "../api.js";
import type { Filtres } from "../directionApi.js";
import { type EtatFiltres, periodes } from "../useFiltres.js";

interface Option { valeur: string; label: string }

function nomDe(x: { nom?: string; libelle?: string; code?: string }): string {
  return x.nom ?? x.libelle ?? x.code ?? "Sans nom";
}

function vers(items: { id?: string; nom?: string; libelle?: string; code?: string }[]): Option[] {
  return items
    .filter((x) => x.id)
    .map((x) => ({ valeur: String(x.id), label: nomDe(x) }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

const ETIQUETTES: Record<keyof Filtres, string> = {
  coordination: "Coordination",
  intendance: "Intendance",
  commission: "Commission",
  tribu: "Tribu",
  volet: "Volet",
  evenement: "Activité",
  pays: "Pays",
  genre: "Genre",
  type_membre: "Statut de membre",
  depuis: "À partir du",
  jusqu_a: "Jusqu'au",
};

export function FilterBar({ token, etat }: { token: string; etat: EtatFiltres }): JSX.Element {
  const { filtres, definir, reinitialiser, actifs } = etat;
  const [ouvert, setOuvert] = useState(false);
  const [refs, setRefs] = useState<{
    coordinations: Option[]; intendances: Option[]; commissions: Option[]; tribus: Option[];
  }>({ coordinations: [], intendances: [], commissions: [], tribus: [] });

  useEffect(() => {
    let vivant = true;
    // Failures are swallowed on purpose: the reference lists decorate the filter bar,
    // and a dashboard that refuses to render because one lookup list is unavailable
    // helps nobody. The pickers simply stay empty and the figures still show.
    Promise.all([
      listAdminCoordinations(token).catch(() => [] as Coordination[]),
      listAdminIntendances(token).catch(() => [] as Intendance[]),
      listAdminCommissions(token).catch(() => [] as Commission[]),
      listAdminTribus(token).catch(() => [] as Tribu[]),
    ]).then(([co, i, c, t]) => {
      if (!vivant) return;
      setRefs({
        coordinations: vers(co), intendances: vers(i), commissions: vers(c), tribus: vers(t),
      });
    });
    return () => { vivant = false; };
  }, [token]);

  const periodeActive = useMemo(() => {
    const p = periodes().find((x) => x.depuis === filtres.depuis && !filtres.jusqu_a);
    return p?.cle ?? (filtres.depuis || filtres.jusqu_a ? "perso" : "tout");
  }, [filtres.depuis, filtres.jusqu_a]);

  const chips = (Object.keys(ETIQUETTES) as (keyof Filtres)[])
    .filter((k) => filtres[k])
    .map((k) => {
      const brut = String(filtres[k]);
      const source =
        k === "coordination" ? refs.coordinations
          : k === "intendance" ? refs.intendances
            : k === "commission" ? refs.commissions
              : k === "tribu" ? refs.tribus : [];
      const lisible = source.find((o) => o.valeur === brut)?.label ?? brut;
      return { cle: k, texte: `${ETIQUETTES[k]} : ${lisible}` };
    });

  function choisirPeriode(cle: string): void {
    const p = periodes().find((x) => x.cle === cle);
    const suivant: Filtres = { ...filtres };
    delete suivant.depuis;
    delete suivant.jusqu_a;
    if (p?.depuis) suivant.depuis = p.depuis;
    etat.remplacer(suivant);
  }

  return (
    <section className="filtres" aria-label="Filtres du tableau de bord">
      <div className="filtres-tete">
        <div className="segmente" role="group" aria-label="Période">
          {periodes().map((p) => (
            <button
              key={p.cle}
              type="button"
              className={`segmente-item${periodeActive === p.cle ? " est-actif" : ""}`}
              aria-pressed={periodeActive === p.cle}
              onClick={() => choisirPeriode(p.cle)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          aria-expanded={ouvert}
          onClick={() => setOuvert((v) => !v)}
        >
          {ouvert ? "Masquer les filtres" : "Filtrer"}
          {actifs > 0 && <span className="badge-compteur">{actifs}</span>}
        </button>
        {actifs > 0 && (
          <button type="button" className="link" onClick={reinitialiser}>Tout effacer</button>
        )}
      </div>

      {chips.length > 0 && (
        <ul className="filtres-chips" aria-label="Filtres appliqués">
          {chips.map((c) => (
            <li key={c.cle}>
              <button
                type="button"
                className="chip"
                onClick={() => definir(c.cle, undefined)}
                aria-label={`Retirer le filtre ${c.texte}`}
              >
                {c.texte}
                <span aria-hidden="true">&times;</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {ouvert && (
        <div className="filtres-grille">
          <Selecteur
            id="f-coordination" label="Coordination" options={refs.coordinations}
            valeur={filtres.coordination} onChange={(v) => definir("coordination", v)}
          />
          <Selecteur
            id="f-intendance" label="Intendance" options={refs.intendances}
            valeur={filtres.intendance} onChange={(v) => definir("intendance", v)}
          />
          <Selecteur
            id="f-commission" label="Commission" options={refs.commissions}
            valeur={filtres.commission} onChange={(v) => definir("commission", v)}
          />
          <Selecteur
            id="f-tribu" label="Tribu" options={refs.tribus}
            valeur={filtres.tribu} onChange={(v) => definir("tribu", v)}
          />
          <Selecteur
            id="f-volet" label="Volet"
            options={[{ valeur: "A", label: "Volet A" }, { valeur: "B", label: "Volet B" }]}
            valeur={filtres.volet} onChange={(v) => definir("volet", v)}
          />
          <Selecteur
            id="f-genre" label="Genre"
            options={[{ valeur: "M", label: "Masculin" }, { valeur: "F", label: "Féminin" }]}
            valeur={filtres.genre} onChange={(v) => definir("genre", v)}
          />
          <label htmlFor="f-depuis">
            <span>À partir du</span>
            <input
              id="f-depuis" type="date" value={filtres.depuis ?? ""}
              onChange={(e) => definir("depuis", e.target.value || undefined)}
            />
          </label>
          <label htmlFor="f-jusqua">
            <span>Jusqu'au</span>
            <input
              id="f-jusqua" type="date" value={filtres.jusqu_a ?? ""}
              onChange={(e) => definir("jusqu_a", e.target.value || undefined)}
            />
          </label>
        </div>
      )}
    </section>
  );
}

function Selecteur({
  id, label, options, valeur, onChange,
}: {
  id: string; label: string; options: Option[];
  valeur: string | undefined; onChange: (v: string | undefined) => void;
}): JSX.Element {
  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        value={valeur ?? ""}
        disabled={options.length === 0}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">{options.length === 0 ? "Liste indisponible" : "Toutes"}</option>
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
