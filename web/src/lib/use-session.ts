"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  DEFAULT_PERMISSIONS,
  getAuthContext,
  type CurrentUser,
  type Permissions,
} from "@/lib/auth";
import {
  ensureSessionLoaded,
  getPendingSessionSnapshot,
  getSessionSnapshot,
  hydrateSessionFromStorage,
  subscribeSession,
} from "@/lib/session-store";

export type SessionUser = CurrentUser;

export function useSession() {
  const state = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getPendingSessionSnapshot,
  );

  useEffect(() => {
    hydrateSessionFromStorage();
    void ensureSessionLoaded(() => getAuthContext({ timeoutMs: 8000 }));
  }, []);

  return state;
}

export function useAuth(): ReturnType<typeof useSession> & { permissions: Permissions } {
  const state = useSession();
  return {
    ...state,
    permissions: state.user?.permissions ?? DEFAULT_PERMISSIONS,
  };
}
