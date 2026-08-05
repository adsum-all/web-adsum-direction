// Page Calendrier — véritable calendrier (mois par défaut, semaine, année).
// Chaque cellule est cliquable et ouvre un panneau latéral (slide-over) avec le
// détail des activités du jour puis le détail complet d'une activité.

import { useEffect, useMemo, useState } from "react";

import { PageHeader, RefreshBar } from "../components/PageHeader.js";
import { EmptyState, ErrorState, SkeletonBlock } from "../components/States.js";
import { InfoTip } from "../components/InfoTip.js";
import { useDirection } from "../DirectionContext.js";
import { listEvenements, listTypesEvenements, type Evenement, type TypeEvenement } from "../api.js";
import { useResource } from "../useResource.js";

type ViewMode = "week" | "month" | "year";

const WEEKDAYS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function rangeFor(view: ViewMode, cursor: Date): { from: Date; to: Date } {
  if (view === "week") { const from = startOfWeek(cursor); return { from, to: addDays(from, 7) }; }
  if (view === "year") return { from: new Date(cursor.getFullYear(), 0, 1), to: new Date(cursor.getFullYear() + 1, 0, 1) };
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const from = startOfWeek(first);
  return { from, to: addDays(from, 42) };
}

function timeOf(ev: Evenement): string {
  return ev.debut ? new Date(ev.debut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
}

export function CalendarPage(): JSX.Element {
  const { session, reloadAll, isRefreshing, lastUpdate, onLogout } = useDirection();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Evenement | null>(null);

  const { from, to } = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  const fromKey = from.toISOString();
  const toKey = to.toISOString();

  const evts = useResource(
    () => listEvenements(session.token, { debut: fromKey, fin: toKey }),
    [session.token, fromKey, toKey],
    (err) => { if ((err as { status?: number })?.status === 401) onLogout(); },
  );
  const types = useResource(() => listTypesEvenements(session.token), [session.token]);

  const filtered = useMemo(() => {
    const all = evts.data ?? [];
    return typeFilter === "all" ? all : all.filter((e) => (e.type ?? "").toString() === typeFilter);
  }, [evts.data, typeFilter]);

  const byDay = useMemo(() => {
    const map = new Map<string, Evenement[]>();
    for (const ev of filtered) {
      if (!ev.debut) continue;
      const k = iso(new Date(ev.debut));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(ev);
    }
    for (const list of map.values()) list.sort((a, b) => (a.debut ?? "").localeCompare(b.debut ?? ""));
    return map;
  }, [filtered]);

  const label = view === "year"
    ? String(cursor.getFullYear())
    : view === "month"
      ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
      : (() => { const s = startOfWeek(cursor); const e = addDays(s, 6);
          return `${s.getDate()} ${MONTHS[s.getMonth()]!.toLowerCase()} → ${e.getDate()} ${MONTHS[e.getMonth()]!.toLowerCase()} ${e.getFullYear()}`; })();

  const step = (dir: -1 | 1) => {
    const c = new Date(cursor);
    if (view === "week") c.setDate(c.getDate() + dir * 7);
    else if (view === "month") c.setMonth(c.getMonth() + dir, 1);
    else c.setFullYear(c.getFullYear() + dir, 0, 1);
    setCursor(c);
  };

  const openDay = (dayKey: string) => { setSelectedEvent(null); setSelectedDay(dayKey); };

  return (
    <>
      <PageHeader description="Toutes les activités programmées, en cours ou terminées. Cliquez sur un jour pour ouvrir le détail." />
      <RefreshBar onReload={() => { reloadAll(); evts.reload(); }} isRefreshing={isRefreshing || evts.loading} lastUpdate={lastUpdate} />

      <section className="card cal-card">
        <div className="cal-toolbar">
          <div className="cal-nav">
            <button type="button" className="cal-arrow" onClick={() => step(-1)} aria-label="Période précédente">‹</button>
            <button type="button" className="cal-today" onClick={() => setCursor(new Date())}>Aujourd'hui</button>
            <button type="button" className="cal-arrow" onClick={() => step(1)} aria-label="Période suivante">›</button>
            <h2 className="cal-title">{label}</h2>
            <span className="cal-count">{filtered.length} activité(s)</span>
            <InfoTip
              label="Interprétation du calendrier"
              content={{
                measure: "Chaque pastille est une activité positionnée sur son jour de début.",
                formula: "GET /admin/evenements filtré sur la période affichée",
                period: "Période visible (semaine, mois ou année sélectionnée)",
                limits: "Les activités sans date de début ne sont pas positionnables sur la grille. Cliquez une cellule pour voir le détail du jour.",
              }}
            />
          </div>
          <div className="cal-tools">
            <div className="segmented" role="group" aria-label="Mode d'affichage">
              {([["week", "Semaine"], ["month", "Mois"], ["year", "Année"]] as const).map(([k, l]) => (
                <button key={k} type="button" className={`segmented-btn${view === k ? " is-active" : ""}`} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>
              ))}
            </div>
            {(types.data ?? []).length > 0 && (
              <label className="pager-size">
                <span className="pager-size-label">Type</span>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filtrer par type">
                  <option value="all">Tous les types</option>
                  {(types.data ?? []).map((t: TypeEvenement) => (
                    <option key={t.code ?? t.id ?? t.libelle} value={(t.code ?? t.id ?? t.libelle) as string}>{t.libelle ?? t.code}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        {evts.error && <ErrorState message={evts.error} onRetry={evts.reload} />}
        {evts.loading && filtered.length === 0 && <SkeletonBlock height={320} />}

        {!evts.error && (
          view === "year"
            ? <YearView year={cursor.getFullYear()} byDay={byDay} onPickDay={openDay} />
            : <Grid from={view === "week" ? startOfWeek(cursor) : rangeFor("month", cursor).from}
                    weeks={view === "week" ? 1 : 6}
                    month={view === "month" ? cursor.getMonth() : null}
                    byDay={byDay} onPickDay={openDay} onPickEvent={(ev) => { setSelectedDay(ev.debut ? iso(new Date(ev.debut)) : null); setSelectedEvent(ev); }} />
        )}

        {!evts.loading && !evts.error && filtered.length === 0 && (
          <EmptyState
            title="Aucune activité sur cette période"
            description="Naviguez vers un autre mois, passez en vue annuelle ou retirez le filtre par type. Si le calendrier reste vide, aucune activité n'a été publiée côté ADSUM Admin."
          />
        )}
      </section>

      {selectedDay && (
        <DayDrawer
          dayKey={selectedDay}
          items={byDay.get(selectedDay) ?? []}
          event={selectedEvent}
          onSelectEvent={setSelectedEvent}
          onClose={() => { setSelectedDay(null); setSelectedEvent(null); }}
        />
      )}
    </>
  );
}

function Grid({
  from, weeks, month, byDay, onPickDay, onPickEvent,
}: {
  from: Date; weeks: number; month: number | null;
  byDay: Map<string, Evenement[]>;
  onPickDay: (k: string) => void;
  onPickEvent: (ev: Evenement) => void;
}): JSX.Element {
  const todayKey = iso(new Date());
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(from, i));
  return (
    <div className="cal-grid" role="grid" aria-label="Grille du calendrier">
      {WEEKDAYS.map((w) => <div key={w} className="cal-head" role="columnheader">{w}</div>)}
      {cells.map((d) => {
        const key = iso(d);
        const list = byDay.get(key) ?? [];
        const out = month !== null && d.getMonth() !== month;
        return (
          <div
            key={key}
            role="gridcell"
            tabIndex={0}
            className={`cal-cell${out ? " is-out" : ""}${key === todayKey ? " is-today" : ""}${list.length ? " has-events" : ""}`}
            onClick={() => onPickDay(key)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPickDay(key); } }}
            aria-label={`${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} — ${list.length} activité(s)`}
          >
            <span className="cal-daynum">{d.getDate()}</span>
            <ul className="cal-events">
              {list.slice(0, 3).map((ev) => (
                <li key={ev.id}>
                  <button
                    type="button"
                    className={`cal-chip type-${(ev.type ?? "autre").toString().toLowerCase().replace(/[^a-z0-9]/g, "")}`}
                    title={`${timeOf(ev)} ${ev.titre}`}
                    onClick={(e) => { e.stopPropagation(); onPickEvent(ev); }}
                  >
                    <span className="cal-chip-time">{timeOf(ev)}</span> {ev.titre || "Sans titre"}
                  </button>
                </li>
              ))}
              {list.length > 3 && <li className="cal-more">+ {list.length - 3} autres</li>}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function YearView({ year, byDay, onPickDay }: { year: number; byDay: Map<string, Evenement[]>; onPickDay: (k: string) => void }): JSX.Element {
  const todayKey = iso(new Date());
  return (
    <div className="cal-year">
      {MONTHS.map((m, mi) => {
        const first = new Date(year, mi, 1);
        const start = startOfWeek(first);
        const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
        const total = cells.reduce((n, d) => (d.getMonth() === mi ? n + (byDay.get(iso(d))?.length ?? 0) : n), 0);
        return (
          <div key={m} className="cal-mini">
            <div className="cal-mini-head">
              <span>{m}</span>
              <span className="cal-mini-count">{total}</span>
            </div>
            <div className="cal-mini-grid">
              {WEEKDAYS.map((w) => <span key={w} className="cal-mini-dow">{w[0]}</span>)}
              {cells.map((d) => {
                const key = iso(d);
                const n = byDay.get(key)?.length ?? 0;
                if (d.getMonth() !== mi) return <span key={key} className="cal-mini-day is-out" />;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`cal-mini-day${n ? " has-events" : ""}${key === todayKey ? " is-today" : ""}`}
                    onClick={() => onPickDay(key)}
                    title={`${d.toLocaleDateString("fr-FR")} — ${n} activité(s)`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const HIDDEN_KEYS = new Set(["id", "titre", "debut", "fin", "type", "volet", "lieu", "statut"]);

function DayDrawer({
  dayKey, items, event, onSelectEvent, onClose,
}: {
  dayKey: string; items: Evenement[]; event: Evenement | null;
  onSelectEvent: (ev: Evenement | null) => void;
  onClose: () => void;
}): JSX.Element {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const dayLabel = new Date(`${dayKey}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Activités du ${dayLabel}`}>
        <header className="drawer-head">
          <div>
            <p className="drawer-eyebrow">{items.length} activité(s)</p>
            <h2 className="drawer-title">{dayLabel}</h2>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Fermer le panneau">✕</button>
        </header>
        <div className="drawer-body">
          {items.length === 0 && (
            <EmptyState title="Aucune activité ce jour" description="Sélectionnez un autre jour ou changez de période." />
          )}
          {items.length > 0 && !event && (
            <ul className="drawer-list">
              {items.map((ev) => (
                <li key={ev.id}>
                  <button type="button" className="drawer-item" onClick={() => onSelectEvent(ev)}>
                    <span className="drawer-item-time">{timeOf(ev) || "—"}</span>
                    <span className="drawer-item-body">
                      <span className="drawer-item-title">{ev.titre || "Sans titre"}</span>
                      <span className="drawer-item-meta">{[ev.type, ev.volet, ev.lieu, ev.statut].filter(Boolean).join(" · ") || "Détails à venir"}</span>
                    </span>
                    <span className="drawer-item-arrow" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {event && (
            <div className="drawer-detail">
              <button type="button" className="drawer-back" onClick={() => onSelectEvent(null)}>‹ Toutes les activités du jour</button>
              <h3 className="drawer-detail-title">{event.titre || "Sans titre"}</h3>
              <dl className="detail-list">
                <Row label="Début" value={event.debut ? new Date(event.debut).toLocaleString("fr-FR") : "—"} />
                <Row label="Fin" value={event.fin ? new Date(event.fin).toLocaleString("fr-FR") : "—"} />
                <Row label="Type" value={event.type ?? "—"} />
                <Row label="Volet" value={event.volet ?? "—"} />
                <Row label="Lieu" value={event.lieu ?? "—"} />
                <Row label="Statut" value={event.statut ?? "—"} />
                {Object.entries(event)
                  .filter(([k, v]) => !HIDDEN_KEYS.has(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
                  .map(([k, v]) => <Row key={k} label={k.replace(/_/g, " ")} value={String(v)} />)}
              </dl>
              <p className="muted small">Identifiant technique : {event.id}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
