// Courbe des arrivées cumulées pour une activité.
// L'API n'expose pas encore l'horodatage des pointages. On simule une courbe
// en cloche (avant → pendant → fin) calibrée sur les totaux réels, pour
// donner un ordre de grandeur visuel. Le libellé signale la projection.

interface Props {
  presents: number;
  partiels: number;
  startISO: string | null;
}

const BINS = 16;

function bellShape(n: number): number[] {
  // Densité gaussienne centrée à 55% du créneau, écart-type ~0.18
  const mu = 0.55;
  const sigma = 0.18;
  const raw: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const y = Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));
    raw.push(y);
  }
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((y) => y / sum);
}

export function ArrivalsChart({ presents, partiels, startISO }: Props): JSX.Element {
  const totalArrivals = presents + partiels;
  if (totalArrivals === 0) {
    return (
      <div className="chart-empty" role="status">
        <span className="chart-empty-dot" aria-hidden="true" />
        <p>Aucun pointage enregistré : la courbe s'activera dès les premières arrivées.</p>
      </div>
    );
  }

  const shape = bellShape(BINS);
  const perBin = shape.map((p) => Math.round(p * totalArrivals));
  // Ajuste l'arrondi pour retomber sur le total exact
  const rounded = perBin.reduce((a, b) => a + b, 0);
  if (rounded !== totalArrivals && perBin.length > 0) {
    const mid = Math.floor(BINS / 2);
    perBin[mid] = (perBin[mid] ?? 0) + (totalArrivals - rounded);
  }
  const cumulative: number[] = [];
  perBin.reduce((acc, v, i) => (cumulative[i] = acc + v), 0);

  const width = 560;
  const height = 200;
  const padL = 40;
  const padR = 14;
  const padT = 18;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxY = cumulative[cumulative.length - 1] || 1;
  const step = plotW / (BINS - 1);

  const start = startISO ? new Date(startISO) : null;
  const durationMin = 120; // fenêtre standard 2h
  const labelAt = (idx: number): string => {
    if (!start) return `${Math.round((idx / (BINS - 1)) * 100)}%`;
    const t = new Date(start.getTime() + (idx / (BINS - 1)) * durationMin * 60000);
    return t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  const coords = cumulative.map((v, i) => ({
    x: padL + step * i,
    y: padT + plotH * (1 - v / maxY),
    v,
    label: labelAt(i),
  }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1]!.x} ${padT + plotH} L ${coords[0]!.x} ${padT + plotH} Z`;

  const barsMax = Math.max(...perBin, 1);
  const barW = Math.max(step * 0.55, 6);

  return (
    <div className="arrivals-wrap">
      <div className="arrivals-legend">
        <span><i className="arrivals-dot arrivals-bars" /> Arrivées par créneau (5 min)</span>
        <span><i className="arrivals-dot arrivals-line" /> Cumul des présents</span>
      </div>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Courbe d'arrivées, ${totalArrivals} pointages cumulés`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="arrivals-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b82d8" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#5b82d8" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = padT + plotH * (1 - f);
          const v = Math.round(maxY * f);
          return (
            <g key={i}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} className="grid-line" />
              <text x={padL - 6} y={y + 3.5} textAnchor="end" className="axis-num">{v}</text>
            </g>
          );
        })}
        {perBin.map((v, i) => {
          const h = (v / barsMax) * plotH * 0.6;
          const x = padL + step * i - barW / 2;
          const y = padT + plotH - h;
          return v > 0 ? (
            <rect key={i} x={x} y={y} width={barW} height={h} rx={2} fill="#c9d5f2">
              <title>{`${labelAt(i)} : ${v} arrivée${v > 1 ? "s" : ""}`}</title>
            </rect>
          ) : null;
        })}
        <path d={areaPath} fill="url(#arrivals-area)" />
        <path d={linePath} fill="none" stroke="#2a4fad" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          i % 3 === 0 || i === coords.length - 1 ? (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r={3} fill="#fff" stroke="#2a4fad" strokeWidth={1.6} />
              <text x={c.x} y={height - 10} textAnchor="middle" className="bar-cat">{c.label}</text>
            </g>
          ) : null
        ))}
      </svg>
      <p className="modality-note">
        Courbe indicative basée sur une distribution en cloche calibrée sur les totaux réels - remplacée dès que l'API exposera l'horodatage des pointages.
      </p>
    </div>
  );
}
