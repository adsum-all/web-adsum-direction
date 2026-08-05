// Minimal hash-based router - no dependency added.
// Reads window.location.hash and exposes navigate(). Persists via history.

import { useCallback, useEffect, useState } from "react";

export type RouteKey =
  | "overview"
  | "live"
  | "calendar"
  | "participation"
  | "absences"
  | "organization"
  | "attendance"
  | "quality"
  | "profile";

export const ROUTES: { key: RouteKey; path: string; label: string }[] = [
  { key: "overview", path: "/overview", label: "Vue d'ensemble" },
  { key: "live", path: "/live", label: "Activité en direct" },
  { key: "calendar", path: "/calendar", label: "Calendrier" },
  { key: "participation", path: "/participation", label: "Participation" },
  { key: "absences", path: "/absences", label: "Absences & motifs" },
  { key: "organization", path: "/organization", label: "Organisation" },
  { key: "attendance", path: "/attendance", label: "Assiduité" },
  { key: "quality", path: "/quality", label: "Qualité des données" },
  { key: "profile", path: "/profile", label: "Profil" },
];

function read(): RouteKey {
  const raw = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#/, "");
  const match = ROUTES.find((r) => r.path === raw);
  return match?.key ?? "overview";
}

export function useRoute(): { route: RouteKey; navigate: (key: RouteKey) => void } {
  const [route, setRoute] = useState<RouteKey>(() => read());
  useEffect(() => {
    const onHash = () => setRoute(read());
    window.addEventListener("hashchange", onHash);
    if (!window.location.hash) window.location.replace("#/overview");
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = useCallback((key: RouteKey) => {
    const r = ROUTES.find((x) => x.key === key);
    if (r) window.location.hash = r.path;
  }, []);
  return { route, navigate };
}
