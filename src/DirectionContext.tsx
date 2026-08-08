// Shared data provider for every Direction page. Fetches statistics and
// participation once, exposes reload + last update, and forwards a session
// expired signal to the caller.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  ApiError,
  getParticipationGlobal,
  getStatistiques,
  type ParticipationGlobal,
  type Session,
  type Statistiques,
} from "./api.js";
import { useFiltres, type EtatFiltres } from "./useFiltres.js";
import { useResource, type ResourceState } from "./useResource.js";

interface Ctx {
  session: Session;
  /** The filter set governing every analytical panel, held in the URL. Shared here
   *  so two pages cannot disagree about what period the reader is looking at. */
  filtres: EtatFiltres;
  stats: ResourceState<Statistiques>;
  participation: ResourceState<ParticipationGlobal>;
  lastUpdate: Date | null;
  isRefreshing: boolean;
  reloadAll: () => void;
  onLogout: () => void;
}

const DirectionContext = createContext<Ctx | null>(null);

export function DirectionProvider({
  session,
  onLogout,
  children,
}: {
  session: Session;
  onLogout: () => void;
  children: ReactNode;
}): JSX.Element {
  const onExpired = useCallback(
    (err: unknown) => { if (err instanceof ApiError && err.status === 401) onLogout(); },
    [onLogout],
  );
  const filtres = useFiltres();
  const stats = useResource(() => getStatistiques(session.token), [session.token], onExpired);
  const participation = useResource(() => getParticipationGlobal(session.token), [session.token], onExpired);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const reloadAll = useCallback(() => {
    stats.reload();
    participation.reload();
    setLastUpdate(new Date());
  }, [stats, participation]);

  useEffect(() => {
    const t = window.setInterval(reloadAll, 60000);
    return () => window.clearInterval(t);
  }, [reloadAll]);

  useEffect(() => {
    if (!stats.loading && !participation.loading && stats.data && participation.data && !lastUpdate) {
      setLastUpdate(new Date());
    }
  }, [stats.loading, stats.data, participation.loading, participation.data, lastUpdate]);

  const value = useMemo<Ctx>(() => ({
    session,
    filtres,
    stats,
    participation,
    lastUpdate,
    isRefreshing: stats.loading || participation.loading,
    reloadAll,
    onLogout,
  }), [session, filtres, stats, participation, lastUpdate, reloadAll, onLogout]);

  return <DirectionContext.Provider value={value}>{children}</DirectionContext.Provider>;
}

export function useDirection(): Ctx {
  const ctx = useContext(DirectionContext);
  if (!ctx) throw new Error("useDirection must be used inside DirectionProvider");
  return ctx;
}
