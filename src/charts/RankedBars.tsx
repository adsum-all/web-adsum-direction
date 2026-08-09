// Ranked comparison: one row per unit, volume as a bar, rate as a marker.
//
// The direction's recurring question about a list of units is not "which is biggest"
// but "which is doing badly", and those are different orderings. A commission of
// twelve at forty per cent needs attention a commission of two hundred at
// seventy-eight does not, and a chart showing only volume buries it.
//
// So both are drawn: the bar is the volume, the marker is the rate, and the sort is
// the reader's choice. Vertical rows rather than a column chart because unit names
// are long and rotated labels are labels nobody reads.

import { useMemo, useState } from "react";

import { formatNombre, formatTaux } from "./geometry.js";

export interface Ligne {
  label: string;
  presents: number;
  partiels: number;
  absents: number;
  total: number;
  taux_presence: number;
  taux_participation: number;
  /** On site. The stacked bar's first segment. */
  presentiel: number;
  /** Followed online without coming. Second segment. */
  en_ligne: number;
  /** Followed, channel unrecorded. Counted apart so the bar still fills. */
  suivi_modalite_inconnue: number;
}

type Tri = "volume" | "taux_bas" | "taux_haut" | "alpha";

const TRIS: { cle: Tri; label: string }[] = [
  { cle: "volume", label: "Volume" },
  { cle: "taux_bas", label: "Taux le plus bas" },
  { cle: "taux_haut", label: "Taux le plus haut" },
  { cle: "alpha", label: "Alphabétique" },
];

//: Below this many observations a rate is reported but not ranked on: a unit with
//: three records can top or bottom the table on one person's absence.
const SEUIL_FIABLE = 10;

export function RankedBars({
  lignes, limite = 12, messageVide,
}: { lignes: Ligne[]; limite?: number; messageVide?: string }): JSX.Element {
  const [tri, setTri] = useState<Tri>("volume");

  const affichees = useMemo(() => {
    const copie = [...lignes];
    if (tri === "volume") copie.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "fr"));
    if (tri === "alpha") copie.sort((a, b) => a.label.localeCompare(b.label, "fr"));
    // Thin units are pushed to the end of a rate ranking rather than dropped: they
    // stay visible and readable, they simply do not get to define the extremes.
    if (tri === "taux_bas") {
      copie.sort((a, b) => {
        const fa = a.total >= SEUIL_FIABLE, fb = b.total >= SEUIL_FIABLE;
        if (fa !== fb) return fa ? -1 : 1;
        return a.taux_participation - b.taux_participation;
      });
    }
    if (tri === "taux_haut") {
      copie.sort((a, b) => {
        const fa = a.total >= SEUIL_FIABLE, fb = b.total >= SEUIL_FIABLE;
        if (fa !== fb) return fa ? -1 : 1;
        return b.taux_participation - a.taux_participation;
      });
    }
    return copie.slice(0, limite);
  }, [lignes, tri, limite]);

  const maxTotal = Math.max(...lignes.map((l) => l.total), 1);
  const restantes = lignes.length - affichees.length;

  if (lignes.length === 0) {
    return <p className="graphe-vide">{messageVide ?? "Aucune donnée sur la période retenue."}</p>;
  }

  return (
    <div className="classement">
      <div className="classement-barre">
        <div className="segmente" role="group" aria-label="Ordre de tri">
          {TRIS.map((t) => (
            <button
              key={t.cle}
              type="button"
              className={`segmente-item${tri === t.cle ? " est-actif" : ""}`}
              aria-pressed={tri === t.cle}
              onClick={() => setTri(t.cle)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <ul className="classement-legende">
          <li><span className="pastille pastille-present" aria-hidden="true" />Venus sur place</li>
          <li><span className="pastille pastille-partiel" aria-hidden="true" />Ont suivi à distance</li>
          <li><span className="pastille pastille-absent" aria-hidden="true" />N&apos;ont pas suivi</li>
          <li><span className="pastille pastille-marqueur" aria-hidden="true" />Part qui a suivi</li>
        </ul>
      </div>

      <ul className="classement-liste">
        {affichees.map((l) => {
          const largeur = (100 * l.total) / maxTotal;
          const part = (v: number) => (l.total ? (100 * v) / l.total : 0);
          const fiable = l.total >= SEUIL_FIABLE;
          return (
            <li key={l.label} className="classement-ligne">
              <span className="classement-nom" title={l.label}>{l.label}</span>
              <span className="classement-piste">
                <span className="classement-barre-empilee" style={{ width: `${largeur}%` }}>
                  {/* The three segments are the two channels plus the non-follows, so
                      they fill the bar exactly. Using "partiels" for the middle one left
                      out everyone who followed online in full, and the bar stopped short
                      of its own total without saying why. */}
                  <span className="seg seg-present" style={{ width: `${part(l.presentiel)}%` }} />
                  <span className="seg seg-partiel" style={{ width: `${part(l.en_ligne)}%` }} />
                  <span className="seg seg-inconnu" style={{ width: `${part(l.suivi_modalite_inconnue)}%` }} />
                  <span className="seg seg-absent" style={{ width: `${part(l.absents)}%` }} />
                </span>
                <span
                  className="classement-marqueur"
                  style={{ left: `${Math.min(99.4, (largeur * l.taux_participation) / 100)}%` }}
                  aria-hidden="true"
                />
              </span>
              <span className={`classement-taux${fiable ? "" : " est-fragile"}`}>
                {formatTaux(l.taux_participation)}
                {!fiable && (
                  <abbr title={`Calculé sur ${l.total} observation${l.total > 1 ? "s" : ""} seulement, à interpréter avec prudence.`}>
                    {" "}!
                  </abbr>
                )}
              </span>
              <span className="classement-total">{formatNombre(l.total)}</span>
            </li>
          );
        })}
      </ul>

      {restantes > 0 && (
        <p className="muted small">
          {restantes} autre{restantes > 1 ? "s" : ""} entité{restantes > 1 ? "s" : ""} non affichée{restantes > 1 ? "s" : ""}. Utilisez les filtres pour restreindre le périmètre.
        </p>
      )}
    </div>
  );
}
