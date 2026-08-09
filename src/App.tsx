import { useCallback, useState } from "react";

import { type Session } from "./api.js";
import { Login } from "./components/Login.js";
import { Sidebar } from "./components/Sidebar.js";
import { DirectionProvider } from "./DirectionContext.js";
import { useRoute, ROUTES, type RouteKey } from "./router.js";

import { OverviewPage } from "./pages/Overview.js";
import { LiveActivityPage } from "./pages/LiveActivity.js";
import { CalendarPage } from "./pages/Calendar.js";
import { ParticipationPage } from "./pages/Participation.js";
import { AbsencesPage } from "./pages/Absences.js";
import { OrganizationPage } from "./pages/Organization.js";
import { AttendancePage } from "./pages/Attendance.js";
import { DataQualityPage } from "./pages/DataQuality.js";
import { ProfilePage } from "./pages/Profile.js";
import { CrossingsPage } from "./pages/Crossings.js";
import { HierarchyPage } from "./pages/Hierarchy.js";
import { MembersPage } from "./pages/Members.js";

const SESSION_KEY = "adsum.dir.token";

function loadSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.token === "string" && parsed.token.length > 0) {
      return { token: parsed.token, role: typeof parsed.role === "string" ? parsed.role : "" };
    }
    return null;
  } catch { return null; }
}
function saveSession(s: Session): void { try { window.localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* private mode */ } }
function clearSession(): void { try { window.localStorage.removeItem(SESSION_KEY); } catch { /* private mode */ } }

export function App(): JSX.Element {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const onAuth = useCallback((s: Session) => { saveSession(s); setSession(s); }, []);
  const onLogout = useCallback(() => { clearSession(); setSession(null); }, []);

  if (!session) return <Login onAuth={onAuth} />;
  return (
    <DirectionProvider session={session} onLogout={onLogout}>
      <Shell onLogout={onLogout} role={session.role} />
    </DirectionProvider>
  );
}

function Shell({ onLogout, role }: { onLogout: () => void; role: string }): JSX.Element {
  const { route, navigate } = useRoute();
  const current = ROUTES.find((r) => r.key === route) ?? ROUTES[0]!;
  return (
    <div className="app-shell">
      <Sidebar route={route} onNavigate={navigate} onLogout={onLogout} role={role} />
      <div className="app-main">
        <header className="topbar-app" role="banner">
          <p className="topbar-crumb">Direction</p>
          <h1 className="topbar-h1">{current.label}</h1>
          <div className="topbar-actions">
            <span className="event-chip" title="Vue consolidée, lecture seule">
              <span className="event-dot" aria-hidden="true" />
              Lecture seule
            </span>
          </div>
        </header>
        <main className="main-scroll" id="content">
          <div className="page">
            <PageContent route={route} onNavigate={navigate} />
          </div>
        </main>
      </div>
    </div>
  );
}

function PageContent({ route, onNavigate }: { route: RouteKey; onNavigate: (r: RouteKey) => void }): JSX.Element {
  switch (route) {
    case "overview": return <OverviewPage onNavigate={onNavigate} />;
    case "live": return <LiveActivityPage />;
    case "calendar": return <CalendarPage />;
    case "participation": return <ParticipationPage />;
    case "absences": return <AbsencesPage />;
    case "organization": return <OrganizationPage />;
    case "attendance": return <AttendancePage />;
    case "crossings": return <CrossingsPage />;
    case "hierarchy": return <HierarchyPage />;
    case "members": return <MembersPage />;
    case "quality": return <DataQualityPage />;
    case "profile": return <ProfilePage />;
    default: return <OverviewPage onNavigate={onNavigate} />;
  }
}
