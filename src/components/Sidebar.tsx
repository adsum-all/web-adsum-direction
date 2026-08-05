// Navigation sidebar for the Direction dashboard.
// Responsive: fixed on desktop, drawer on mobile. Icons inline (no lib).

import { useEffect, useState } from "react";

import { ROUTES, type RouteKey } from "../router.js";
import { useMarque } from "../useMarque.js";

const ICONS: Record<RouteKey, JSX.Element> = {
  overview: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>),
  live: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M5 12a7 7 0 0 1 14 0"/><path d="M2 12a10 10 0 0 1 20 0"/></svg>),
  calendar: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>),
  participation: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17l5-5 4 4 8-9"/><path d="M14 7h7v7"/></svg>),
  absences: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>),
  organization: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="15" width="6" height="5" rx="1"/><rect x="15" y="15" width="6" height="5" rx="1"/><path d="M12 8v3M6 15v-2h12v2"/></svg>),
  attendance: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>),
  quality: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4z"/><path d="M9 12l2 2 4-4"/></svg>),
  profile: (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>),
};

export function Sidebar({
  route,
  onNavigate,
  onLogout,
  role,
}: {
  route: RouteKey;
  onNavigate: (k: RouteKey) => void;
  onLogout: () => void;
  role: string;
}): JSX.Element {
  const marque = useMarque();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return window.localStorage.getItem("adsum.dir.nav.collapsed") === "1"; } catch { return false; }
  });
  useEffect(() => { setOpen(false); }, [route]);
  useEffect(() => {
    document.body.classList.toggle("nav-collapsed", collapsed);
    try { window.localStorage.setItem("adsum.dir.nav.collapsed", collapsed ? "1" : "0"); } catch { /* private mode */ }
  }, [collapsed]);

  return (
    <>
      <button
        type="button"
        className="sidebar-toggle"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          {open
            ? <path d="M6 6l12 12M18 6L6 18" />
            : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
        </svg>
      </button>
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={`app-sidebar${open ? " is-open" : ""}${collapsed ? " is-collapsed" : ""}`} aria-label="Navigation principale">
        <div className="brand">
          <span className="brand-logo" aria-hidden="true">{marque.initiale}</span>
          <span className="brand-text">{marque.marque}<span className="brand-sub">Direction</span></span>
          <button
            type="button"
            className="nav-collapse-btn"
            aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
            aria-pressed={collapsed}
            title={collapsed ? "Déplier le menu" : "Replier le menu"}
            onClick={() => setCollapsed((v) => !v)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
            </svg>
          </button>
        </div>
        <nav className="app-nav">
          <p className="nav-group-title">Pilotage</p>
          <ul>
            {ROUTES.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  className={`nav-item${route === r.key ? " nav-item-active" : ""}`}
                  aria-current={route === r.key ? "page" : undefined}
                  onClick={() => onNavigate(r.key)}
                  title={r.label}
                >
                  <span className="nav-ico" aria-hidden="true">{ICONS[r.key]}</span>
                  <span className="nav-label">{r.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-user">
            <span className="sidebar-user-role">{role || "direction"}</span>
            <span className="sidebar-user-note">Lecture seule</span>
          </div>
          <button type="button" className="link" onClick={onLogout}>Déconnexion</button>
        </div>
      </aside>
    </>
  );
}
