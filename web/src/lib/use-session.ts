"use client";

import { useEffect, useSyncExternalStore } from "react";

import { getAuthContext, type CurrentUser } from "@/lib/auth";
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
