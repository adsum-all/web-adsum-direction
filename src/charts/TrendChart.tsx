// Multi-series trend chart: smooth curves, gradient area, crosshair on hover.
//
// This is the chart the direction reads most, so it is the one that has to hold up:
// the shape has to be true to the points, and the exact figure has to be one hover
// away. A curve you can admire but not interrogate is decoration.

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { formatDateLongue, formatNombre, monotonePath, niceMax } from "./geometry.js";

export interface Serie {
  cle: string;
  label: string;
  couleur: string;
  valeurs: number[];
  /** Draw as a filled area. Reserved for the series carrying the headline quantity. */
  aire?: boolean;
  /** Dashed, for a reference line such as an average. */
  pointille?: boolean;
}

interface TrendProps {
  libelles: string[];
  /** Full label for the tooltip title, defaults to the axis label. */
  titres?: string[];
  dates?: (string | null)[];
  series: Serie[];
  hauteur?: number;
  unite?: string;
  messageVide?: string;
  /** Fixed axis maximum, for a percentage scale that must stay at 100. */
  maxForce?: number;
}

const M = { haut: 16, droite: 18, bas: 38, gauche: 50 };
//: Fallback width, used only before the container has been measured once.
const L_DEFAUT = 900;
//: Rough width of one axis label, in pixels, at the size the stylesheet gives them.
//: Used to decide how many labels fit; measuring each one would cost a reflow per
//: render for a decision that only needs to be approximately right.
const LARGEUR_ETIQUETTE = 58;

/** The rendered width of the chart, so the viewBox maps one unit to one pixel.
 *
 * With a fixed viewBox and preserveAspectRatio="none" the whole drawing is stretched
 * to fit, text included: labels came out horizontally squashed on a narrow screen and
 * stretched on a wide one. Measuring means no scaling at all, so text renders at its
 * true size and label collision can be computed rather than guessed.
 */
function useLargeur(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(L_DEFAUT);
  useLayoutEffect(() => {
    const noeud = ref.current;
    if (!noeud) return undefined;
    const mesurer = (): void => setLargeur(Math.max(320, Math.round(noeud.getBoundingClientRect().width)));
    mesurer();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(noeud);
    return () => observateur.disconnect();
  }, []);
  return [ref, largeur];
}

/** Where to put the tooltip so it stays inside the chart.
 *
 * Centred on the point, half of it falls outside near either edge and the reader loses
 * the very figures the tooltip exists to show: the title and the first characters of
 * each label were cut off on the left-hand points. Near a border it anchors to that
 * border instead, and it never sits further than the plot itself.
 */
function ancrageInfobulle(x: number, largeur: number): React.CSSProperties {
  const ratio = largeur > 0 ? x / largeur : 0.5;
  if (ratio < 0.22) return { left: 0, transform: "none" };
  if (ratio > 0.78) return { right: 0, left: "auto", transform: "none" };
  return { left: `${ratio * 100}%`, transform: "translateX(-50%)" };
}

export function TrendChart({
  libelles, titres, dates, series, hauteur = 260, unite, messageVide, maxForce,
}: TrendProps): JSX.Element {
  const idGradient = useId();
  const [survol, setSurvol] = useState<number | null>(null);
  const [conteneur, L] = useLargeur();

  const n = libelles.length;
  const geo = useMemo(() => {
    const brut = Math.max(
      ...series.flatMap((s) => s.valeurs.filter((v) => Number.isFinite(v))),
      0,
    );
    const echelle = maxForce != null
      ? { max: maxForce, ticks: [0, maxForce / 4, maxForce / 2, (maxForce * 3) / 4, maxForce] }
      : niceMax(brut);
    const largeurTrace = L - M.gauche - M.droite;
    const hauteurTrace = hauteur - M.haut - M.bas;
    // A single point sits in the middle rather than glued to the left axis, where it
    // reads as the start of a trend that does not exist.
    const x = (i: number) => (n <= 1 ? M.gauche + largeurTrace / 2 : M.gauche + (largeurTrace * i) / (n - 1));
    const y = (v: number) => M.haut + hauteurTrace - (hauteurTrace * Math.max(0, v)) / (echelle.max || 1);
    return { echelle, x, y, hauteurTrace, largeurTrace };
  }, [series, n, hauteur, maxForce, L]);

  // How many labels the axis can actually hold, from its measured width rather than a
  // fixed count. Eight labels fit comfortably on a wide screen and collide on a narrow
  // one, and two labels touching are worse than one label missing.
  const pas = useMemo(() => {
    const tiennent = Math.max(2, Math.floor(geo.largeurTrace / LARGEUR_ETIQUETTE));
    return Math.max(1, Math.ceil(n / tiennent));
  }, [n, geo.largeurTrace]);

  const vide = n === 0 || series.length === 0;

  return (
    <div className="graphe" ref={conteneur} role="img" aria-label={messageVide && vide ? messageVide : "Graphique d'évolution"}>
      {vide ? (
        <p className="graphe-vide">{messageVide ?? "Aucune donnée sur la période retenue."}</p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${L} ${hauteur}`}
            preserveAspectRatio="xMidYMid meet"
            className="graphe-svg"
            onMouseLeave={() => setSurvol(null)}
          >
            <defs>
              {series.filter((s) => s.aire).map((s) => (
                <linearGradient key={s.cle} id={`${idGradient}-${s.cle}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.couleur} stopOpacity="0.26" />
                  <stop offset="100%" stopColor={s.couleur} stopOpacity="0.02" />
                </linearGradient>
              ))}
            </defs>

            {geo.echelle.ticks.map((t) => (
              <g key={t}>
                <line
                  x1={M.gauche} x2={L - M.droite} y1={geo.y(t)} y2={geo.y(t)}
                  className="graphe-grille"
                />
                <text x={M.gauche - 8} y={geo.y(t) + 4} className="graphe-axe" textAnchor="end">
                  {formatNombre(t)}{unite === "%" ? " %" : ""}
                </text>
              </g>
            ))}

            {series.map((s) => {
              const pts = s.valeurs.map((v, i) => ({ x: geo.x(i), y: geo.y(v) }));
              const d = monotonePath(pts);
              return (
                <g key={s.cle}>
                  {s.aire && n > 1 && (
                    <path
                      d={`${d} L ${geo.x(n - 1)} ${M.haut + geo.hauteurTrace} L ${geo.x(0)} ${M.haut + geo.hauteurTrace} Z`}
                      fill={`url(#${idGradient}-${s.cle})`}
                    />
                  )}
                  <path
                    d={d}
                    fill="none"
                    stroke={s.couleur}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={s.pointille ? "6 5" : undefined}
                    className="graphe-trace"
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Markers only when they can be told apart; past thirty points they
                      merge into a thick band and hide the curve they annotate. */}
                  {n <= 30 && pts.map((p, i) => (
                    <circle
                      key={i} cx={p.x} cy={p.y} r={survol === i ? 5 : 3}
                      fill="var(--adsum-panel)" stroke={s.couleur} strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
              );
            })}

            {survol != null && (
              <line
                x1={geo.x(survol)} x2={geo.x(survol)} y1={M.haut} y2={M.haut + geo.hauteurTrace}
                className="graphe-reticule"
              />
            )}

            {libelles.map((lb, i) => (
              i % pas === 0 ? (
                <text
                  key={i}
                  x={geo.x(i)}
                  y={hauteur - 14}
                  className="graphe-axe"
                  textAnchor={i === 0 ? "start" : i >= n - 1 ? "end" : "middle"}
                >
                  {lb}
                </text>
              ) : null
            ))}

            {/* Full-height capture bands: pointing at a two-pixel marker is a chore,
                and a chart nobody hovers is a chart whose figures nobody reads. */}
            {libelles.map((_, i) => (
              <rect
                key={`z${i}`}
                x={n <= 1 ? M.gauche : geo.x(i) - geo.largeurTrace / (2 * (n - 1))}
                y={M.haut}
                width={n <= 1 ? geo.largeurTrace : geo.largeurTrace / (n - 1)}
                height={geo.hauteurTrace}
                fill="transparent"
                onMouseEnter={() => setSurvol(i)}
              />
            ))}
          </svg>

          {survol != null && (
            <div
              className="graphe-infobulle"
              style={ancrageInfobulle(geo.x(survol), L)}
              role="status"
            >
              <p className="graphe-infobulle-titre">{titres?.[survol] ?? libelles[survol]}</p>
              {dates?.[survol] && (
                <p className="graphe-infobulle-date">{formatDateLongue(dates[survol])}</p>
              )}
              <ul>
                {series.map((s) => (
                  <li key={s.cle}>
                    <span className="graphe-puce" style={{ background: s.couleur }} aria-hidden="true" />
                    <span className="graphe-infobulle-label">{s.label}</span>
                    <span className="graphe-infobulle-valeur">
                      {formatNombre(s.valeurs[survol] ?? 0)}{unite === "%" ? " %" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="graphe-legende">
            {series.map((s) => (
              <li key={s.cle}>
                <span
                  className={`graphe-puce${s.pointille ? " graphe-puce-pointille" : ""}`}
                  style={{ background: s.couleur }}
                  aria-hidden="true"
                />
                {s.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
