// Selects the "current" or "last" activity for the live-activity page.
// Kept as a pure function so it can be tested in isolation.

import type { ParticipationGlobal } from "./api.js";

export type LiveEvent = ParticipationGlobal["serie_evenements"][number];

// "planned" is not a variant of "last". An activity that has not happened yet has
// no attendance, and presenting it as the last one shows a headline of zero present,
// zero absent, no mobilisation rate, which reads as a collapse rather than as a date
// in the diary. The panel has to say which of the two it is.
export type LiveMode = "live" | "last" | "planned" | "empty";

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

  // The most recent activity that has actually started. Sorting alone put a date
  // months away at the top, and the panel reported an empty future congress as the
  // organisation's latest attendance.
  const passees = withTime.filter((x) => x.t <= now);
  if (passees.length > 0) {
    const last = passees[0]!.ev;
    return { mode: "last", current: [last], reference: last };
  }

  // Nothing has happened yet: the nearest activity ahead, announced as such.
  const prochaine = withTime[withTime.length - 1]!.ev;
  return { mode: "planned", current: [prochaine], reference: prochaine };
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
