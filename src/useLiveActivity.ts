// Selects the "current" or "last" activity for the live-activity page.
// Kept as a pure function so it can be tested in isolation.

import type { ParticipationGlobal } from "./api.js";

export type LiveEvent = ParticipationGlobal["serie_evenements"][number];

export type LiveMode = "live" | "last" | "empty";

export interface LiveSelection {
  mode: LiveMode;
  current: LiveEvent[];  // one entry unless multiple activities run in parallel
  reference: LiveEvent | null;
}

// The current API only exposes `debut` (start) - no end timestamp and no
// status. We consider an activity "in progress" when it started within the
// last 4 hours (typical worship-session duration). This heuristic will be
// replaced once the backend exposes real state timestamps.
const LIVE_WINDOW_MS = 4 * 60 * 60 * 1000;

function toTime(iso: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export function pickLiveActivity(events: readonly LiveEvent[] | undefined, now = Date.now()): LiveSelection {
  if (!events || events.length === 0) return { mode: "empty", current: [], reference: null };

  const withTime = events
    .map((e) => ({ ev: e, t: toTime(e.debut) }))
    .filter((x) => x.t > 0)
    .sort((a, b) => b.t - a.t);

  if (withTime.length === 0) {
    // Fallback: no timestamps at all - take the first entry as reference.
    return { mode: "last", current: [events[0]!], reference: events[0]! };
  }

  const live = withTime.filter((x) => now - x.t <= LIVE_WINDOW_MS && x.t <= now);
  if (live.length > 0) {
    return { mode: "live", current: live.map((x) => x.ev), reference: live[0]!.ev };
  }

  const last = withTime[0]!.ev;
  return { mode: "last", current: [last], reference: last };
}

export function formatEventDate(iso: string | null): string {
  if (!iso) return "Date non renseignée";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date non renseignée";
  return d.toLocaleString("fr-FR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
