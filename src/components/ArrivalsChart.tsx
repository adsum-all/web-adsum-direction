// Arrivals over time for one activity, from the times that were actually recorded.
//
// This component used to draw a Gaussian calibrated on the total and label it
// "indicative". That is a fabricated shape presented as a measurement: the reader saw
// a smooth flow nobody had observed, peaking at fifty five percent of the slot because
// that is where the formula put it. The times existed all along, on every recorded
// entry; nothing was ever read.
//
// Where the recorded times carry no spread, the chart says so rather than drawing a
// curve over a single instant. An empty statement is worth more than an invented one.

import { useEffect, useState } from "react";

import { getArrivees, type Arrivees } from "../directionApi.js";

const HAUTEUR = 200;
const MARGE = { haut: 18, droite: 16, bas: 34, gauche: 44 };

export function ArrivalsChart({
  token,
  evenementId,
}: {
  token: string;
  evenementId: string;
}): JSX.Element {
  const [donnees, setDonnees] = useState<Arrivees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    setDonnees(null);
    setErreur(null);
    void getArrivees(token, evenementId)
      .then((d) => {
        if (vivant) setDonnees(d);
      })
      .catch((e: unknown) => {
        if (vivant) setErreur(e instanceof Error ? e.message : "Erreur réseau");
      });
    return () => {
      vivant = false;
    };
  }, [token, evenementId]);

  if (erreur) {
    return (
      <div className="chart-empty" role="status">
        <span className="chart-empty-dot" aria-hidden="true" />
        <p>{erreur}</p>
      </div>
    );
  }

  if (!donnees) {
    return (
      <div className="chart-empty" role="status">
        <span className="chart-empty-dot" aria-hidden="true" />
        <p>Lecture des horodatages...</p>
      </div>
    );
  }

  if (!donnees.disponible) {
    return (
      <div className="chart-empty" role="status">
        <span className="chart-empty-dot" aria-hidden="true" />
        <p>{donnees.motif ?? "Pas d'étalement à représenter."}</p>
      </div>
    );
  }

  const tranches = donnees.tranches;
  const total = donnees.total ?? tranches.reduce((n, x) => n + x.arrivees, 0);
  const largeur = 560;
  const traceL = largeur - MARGE.gauche - MARGE.droite;
  const traceH = HAUTEUR - MARGE.haut - MARGE.bas;
  const maxCumul = tranches[tranches.length - 1]?.cumul ?? 1;
  const pas = tranches.length > 1 ? traceL / (tranches.length - 1) : 0;
  const points = tranches.map((t, i) => ({
    x: MARGE.gauche + i * pas,
    y: MARGE.haut + traceH - (traceH * t.cumul) / (maxCumul || 1),
    ...t,
  }));
  const trace = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const aire = `${trace} L ${points[points.length - 1]?.x ?? 0} ${MARGE.haut + traceH} L ${points[0]?.x ?? 0} ${MARGE.haut + traceH} Z`;
  // One label every few buckets, never two overlapping, and always the last one: a
  // curve whose right edge carries no time leaves the reader guessing where it ends.
  const espacement = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(traceL / 62))));

  return (
    <div>
      <svg
        viewBox={`0 0 ${largeur} ${HAUTEUR}`}
        preserveAspectRatio="xMidYMid meet"
        className="chart-svg"
        role="img"
        aria-label={`Arrivées cumulées, ${donnees.total} pointages horodatés`}
      >
        <defs>
          <linearGradient id="arrivees-aire" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a4fad" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#2a4fad" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = MARGE.haut + traceH - traceH * p;
          return (
            <g key={p}>
              <line x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y} y2={y} className="chart-grid" />
              <text x={MARGE.gauche - 6} y={y + 3.5} textAnchor="end" className="axis-num">
                {Math.round(maxCumul * p)}
              </text>
            </g>
          );
        })}

        <path d={aire} fill="url(#arrivees-aire)" />
        <path d={trace} fill="none" stroke="#2a4fad" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={p.minutes}>
            <title>{`${p.libelle} : ${p.arrivees} arrivée(s), ${p.cumul} au total (${p.part_cumulee} %)`}</title>
            <circle cx={p.x} cy={p.y} r={3} fill="#fff" stroke="#2a4fad" strokeWidth={1.6} />
            {(i % espacement === 0 || i === points.length - 1) && (
              <text
                x={p.x}
                y={HAUTEUR - 10}
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                className="bar-cat"
              >
                {p.libelle}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="modality-note">
        Arrivées cumulées d&apos;après l&apos;heure enregistrée à chaque pointage, par
        tranches de quinze minutes autour du début de l&apos;activité. {total} pointage
        {total > 1 ? "s" : ""} horodaté{total > 1 ? "s" : ""}.
      </p>
    </div>
  );
}
