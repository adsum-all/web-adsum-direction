// Minimal hash-based router - no dependency added.
// Reads window.location.hash and exposes navigate(). Persists via history.
//
// The hash carries the filter set as a query string, so the path is read from the
// part before "?". Matching the whole hash, as this did, made every filtered URL
// fall back to the overview: the filters were applied and the page silently changed
// under them.

import { useCallback, useEffect, useState } from "react";

export type RouteKey =
  | "overview"
  | "live"
  | "calendar"
  | "participation"
  | "crossings"
  | "hierarchy"
  | "members"
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
  { key: "crossings", path: "/crossings", label: "Croisements" },
  { key: "attendance", path: "/attendance", label: "Assiduité" },
  { key: "members", path: "/members", label: "Suivi des membres" },
  { key: "absences", path: "/absences", label: "Absences & motifs" },
  { key: "organization", path: "/organization", label: "Organisation" },
  { key: "hierarchy", path: "/hierarchy", label: "Hiérarchie" },
  { key: "quality", path: "/quality", label: "Qualité des données" },
  { key: "profile", path: "/profile", label: "Profil" },
];

/** The path portion of the hash, with any filter query stripped. */
export function cheminCourant(): string {
  const brut = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#/, "");
  return brut.split("?")[0] || "/overview";
}

function read(): RouteKey {
  const match = ROUTES.find((r) => r.path === cheminCourant());
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
    if (!r) return;
    // The filters survive navigation: a leader who narrowed to their coordination
    // expects the next page to still be about their coordination, not to silently
    // widen back to the whole organisation.
    const requete = (window.location.hash.split("?")[1] ?? "");
    window.location.hash = `${r.path}${requete ? `?${requete}` : ""}`;
  }, []);
  return { route, navigate };
}
