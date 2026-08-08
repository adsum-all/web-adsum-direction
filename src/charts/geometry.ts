// Shared chart mathematics: scales, ticks, and curve interpolation.
//
// Every chart in the direction reads from this, so two panels showing the same
// figures place them at the same height and round them the same way. Charts that
// each compute their own axis are charts a reader cannot compare, which defeats the
// point of putting them on one screen.

/** Round an axis maximum up to a value a person can read off a grid line. */
export function niceMax(raw: number, divisions = 4): { max: number; ticks: number[] } {
  if (!Number.isFinite(raw) || raw <= 0) return { max: 1, ticks: [0, 1] };
  const rough = raw / divisions;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  // 1, 2, 5, 10 are the steps people read without doing arithmetic.
  const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
  const max = Math.ceil(raw / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { max, ticks };
}

/**
 * A smooth path through the points that never invents a peak between them.
 *
 * Plain cubic smoothing overshoots: three points rising then flat produce a curve
 * that climbs above the highest value and comes back down, drawing an attendance
 * figure the data never contained. Monotone interpolation clamps the tangents so the
 * curve stays inside the values it connects, which is the difference between a chart
 * that is beautiful and one that is also true.
 */
export function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  // Coordinates are lifted into plain number arrays first. Indexing an object array
  // under noUncheckedIndexedAccess yields `T | undefined` at every step, and the
  // arithmetic below reads two neighbours at once: `at` reads plainly and keeps the
  // interpolation legible rather than burying it in assertions.
  const X: number[] = [];
  const Y: number[] = [];
  pts.forEach((p) => { X.push(p.x); Y.push(p.y); });
  const at = (a: number[], i: number): number => a[i] ?? 0;

  if (n === 1) return `M ${at(X, 0)} ${at(Y, 0)}`;
  if (n === 2) return `M ${at(X, 0)} ${at(Y, 0)} L ${at(X, 1)} ${at(Y, 1)}`;

  const dx: number[] = [];
  const pente: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const h = at(X, i + 1) - at(X, i);
    dx.push(h);
    pente.push(h === 0 ? 0 : (at(Y, i + 1) - at(Y, i)) / h);
  }

  // Fritsch-Carlson tangents: zero at every local extremum, so the curve turns at
  // the data point rather than past it.
  const tangente: number[] = new Array(n).fill(0);
  tangente[0] = at(pente, 0);
  tangente[n - 1] = at(pente, n - 2);
  for (let i = 1; i < n - 1; i += 1) {
    const p0 = at(pente, i - 1);
    const p1 = at(pente, i);
    if (p0 * p1 <= 0) {
      tangente[i] = 0;
    } else {
      const w1 = 2 * at(dx, i) + at(dx, i - 1);
      const w2 = at(dx, i) + 2 * at(dx, i - 1);
      tangente[i] = (w1 + w2) / (w1 / p0 + w2 / p1);
    }
  }

  let d = `M ${at(X, 0)} ${at(Y, 0)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = at(dx, i) / 3;
    d += ` C ${at(X, i) + h} ${at(Y, i) + at(tangente, i) * h}`;
    d += ` ${at(X, i + 1) - h} ${at(Y, i + 1) - at(tangente, i + 1) * h}`;
    d += ` ${at(X, i + 1)} ${at(Y, i + 1)}`;
  }
  return d;
}

/** Group digits so four-figure counts stay readable in a tooltip. */
export function formatNombre(v: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(v));
}

export function formatTaux(v: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} %`;
}

/** Short date for an axis: a full date repeated twenty times is unreadable. */
export function formatDateCourte(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(d);
}

export function formatDateLongue(iso: string | null): string {
  if (!iso) return "Date inconnue";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

/**
 * Categorical colours, ordered so neighbours stay distinguishable.
 *
 * Built on the brand blue and walked around the wheel rather than picked at random:
 * a legend where two commissions share a shade is a legend nobody uses. Kept away
 * from the red and green the platform reserves for present and absent, so a
 * categorical bar is never mistaken for a status.
 */
export const PALETTE = [
  "#2a4fad", "#1f8a5b", "#b5731a", "#7b4bc4", "#0d7f96",
  "#c0392b", "#4b6584", "#9b7a1a", "#3563c9", "#2d8f74",
  "#a34a8f", "#5a6f2f",
];

export function couleur(i: number): string {
  return PALETTE[i % PALETTE.length] ?? PALETTE[0]!;
}

/**
 * Ramp used by the cross-tab heatmap, light to deep brand blue.
 *
 * Sequential rather than a rainbow: intensity is the quantity, so a reader ranks
 * cells by how dark they are without consulting a key. Rainbow ramps invent
 * boundaries the data does not have.
 */
export function intensite(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio));
  // Interpolated in sRGB between a near-white and the brand blue. The light end stays
  // off-white so an empty cell is visibly empty rather than merely pale.
  const de: [number, number, number] = [239, 243, 251];
  const vers: [number, number, number] = [26, 55, 130];
  const melange = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${melange(de[0], vers[0])}, ${melange(de[1], vers[1])}, ${melange(de[2], vers[2])})`;
}

/** Text that stays legible on a heatmap cell of the given intensity. */
export function encreSurIntensite(ratio: number): string {
  return ratio > 0.55 ? "#ffffff" : "#101427";
}
