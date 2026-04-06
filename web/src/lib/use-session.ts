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

let sessionLifecycleBound = false;

function bindSessionLifecycleRefresh() {
  if (typeof window === "undefined" || sessionLifecycleBound) {
    return;
  }

  sessionLifecycleBound = true;

  const refreshSession = () => {
    void ensureSessionLoaded(() => getAuthContext({ timeoutMs: 8000 }), true);
  };

  const onVisibilityChange = () => {
    if (!document.hidden) {
      refreshSession();
    }
  };

  window.addEventListener("pageshow", refreshSession);
  window.addEventListener("online", refreshSession);
  document.addEventListener("visibilitychange", onVisibilityChange);
}

export function useSession() {
  const state = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getPendingSessionSnapshot,
  );

  useEffect(() => {
    hydrateSessionFromStorage();
    bindSessionLifecycleRefresh();
    void ensureSessionLoaded(() => getAuthContext({ timeoutMs: 8000 }));
  }, []);

  return state;
}
