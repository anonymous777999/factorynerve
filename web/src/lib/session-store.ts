import { ApiError } from "@/lib/api";
import type { AuthContext, CurrentUser, FactoryAccess, OrganizationContext } from "@/lib/auth";

type SessionState = {
  user: CurrentUser | null;
  factories: FactoryAccess[];
  activeFactoryId: string | null;
  activeFactory: FactoryAccess | null;
  organization: OrganizationContext | null;
  loading: boolean;
  error: string;
  loadedAt: number;
};

const SESSION_TTL_MS = 30_000;
const SESSION_STORAGE_KEY = "dpr:web:session:v1";
let sessionHydratedFromStorage = false;

const PENDING_SESSION_SNAPSHOT: SessionState = {
  user: null,
  factories: [],
  activeFactoryId: null,
  activeFactory: null,
  organization: null,
  loading: true,
  error: "",
  loadedAt: 0,
};

export function getPendingSessionSnapshot(): SessionState {
  return PENDING_SESSION_SNAPSHOT;
}

function readPersistedSession(): Partial<SessionState> | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<SessionState> | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistSessionSnapshot(snapshot: SessionState) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!snapshot.user) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        user: snapshot.user,
        factories: snapshot.factories,
        activeFactoryId: snapshot.activeFactoryId,
        activeFactory: snapshot.activeFactory,
        organization: snapshot.organization,
        loadedAt: snapshot.loadedAt,
      }),
    );
  } catch {
    // Ignore storage failures and continue with in-memory session state.
  }
}

let sessionState: SessionState = getPendingSessionSnapshot();

let inflightSessionLoad: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setSessionState(next: Partial<SessionState>) {
  sessionState = {
    ...sessionState,
    ...next,
  };
  persistSessionSnapshot(sessionState);
  emit();
}

function toSessionError(err: unknown) {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return "";
    }
    if (err.status === 0) {
      return "Backend not reachable. Check API base URL and backend status.";
    }
    return err.message;
  }
  if (err instanceof Error && err.message.includes("aborted")) {
    return "Session check timed out. Backend may be offline.";
  }
  return "Session check failed.";
}

export function getSessionSnapshot() {
  return sessionState;
}

export function hydrateSessionFromStorage() {
  if (sessionHydratedFromStorage) {
    return;
  }
  sessionHydratedFromStorage = true;
  const persisted = readPersistedSession();
  if (!persisted?.user) {
    return;
  }
  setSessionState({
    user: persisted.user ?? null,
    factories: persisted.factories ?? [],
    activeFactoryId: persisted.activeFactoryId ?? null,
    activeFactory: persisted.activeFactory ?? null,
    organization: persisted.organization ?? null,
    loading: false,
    error: "",
    loadedAt: persisted.loadedAt ?? Date.now(),
  });
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function applySessionPayload(payload: CurrentUser | AuthContext | null): Partial<SessionState> {
  if (!payload) {
    return {
      user: null,
      factories: [],
      activeFactoryId: null,
      activeFactory: null,
      organization: null,
    };
  }
  if ("user" in payload) {
    return {
      user: payload.user,
      factories: payload.factories || [],
      activeFactoryId: payload.active_factory_id || null,
      activeFactory: payload.active_factory || null,
      organization: payload.organization || null,
    };
  }
  return {
    user: payload,
  };
}

export function primeSession(payload: CurrentUser | AuthContext | null) {
  setSessionState({
    ...applySessionPayload(payload),
    loading: false,
    error: "",
    loadedAt: Date.now(),
  });
}

export function clearSession() {
  setSessionState({
    user: null,
    factories: [],
    activeFactoryId: null,
    activeFactory: null,
    organization: null,
    loading: false,
    error: "",
    loadedAt: Date.now(),
  });
}

export function invalidateSession() {
  setSessionState({
    loadedAt: 0,
  });
}

export async function ensureSessionLoaded(loader: () => Promise<CurrentUser | AuthContext>, force = false) {
  const fresh =
    sessionState.loadedAt > 0 && Date.now() - sessionState.loadedAt < SESSION_TTL_MS;
  if (!force && fresh && !sessionState.loading) {
    return;
  }
  if (inflightSessionLoad) {
    return inflightSessionLoad;
  }
  const loadStartedAt = Date.now();

  setSessionState({
    loading: sessionState.user ? false : true,
    error: "",
  });

  inflightSessionLoad = loader()
    .then((payload) => {
      if (sessionState.loadedAt > loadStartedAt) {
        return;
      }
      setSessionState({
        ...applySessionPayload(payload),
        loading: false,
        error: "",
        loadedAt: Date.now(),
      });
    })
    .catch((err) => {
      if (sessionState.loadedAt > loadStartedAt) {
        return;
      }
      setSessionState({
        user: null,
        factories: [],
        activeFactoryId: null,
        activeFactory: null,
        organization: null,
        loading: false,
        error: toSessionError(err),
        loadedAt: Date.now(),
      });
    })
    .finally(() => {
      inflightSessionLoad = null;
    });

  return inflightSessionLoad;
}
