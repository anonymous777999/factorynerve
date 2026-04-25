"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GuidanceSurfaceKey =
  | "auth-forgot-help"
  | "auth-login-help"
  | "auth-register-help"
  | "auth-reset-help"
  | "auth-verify-help"
  | "approvals-flow"
  | "attendance-review-flow"
  | "dashboard-launch"
  | "email-summary-flow"
  | "entry-flow"
  | "ocr-home-guide"
  | "ocr-scan-guide"
  | "ocr-verify-guide"
  | "reports-flow"
  | "settings-flow";

type StoredSurfaceState = {
  visitCount: number;
  manualExpanded: boolean | null;
};

type StoredGuidanceState = {
  showTips: boolean;
  surfaces: Record<string, StoredSurfaceState>;
};

type GuidanceSurfaceConfig = {
  autoOpenVisits: number;
  critical: boolean;
  respectGlobal: boolean;
};

const STORAGE_KEY = "dpr:guidance:prefs";
const GUIDANCE_CHANGE_EVENT = "dpr:guidance:changed";

const DEFAULT_STATE: StoredGuidanceState = {
  showTips: true,
  surfaces: {},
};

const SURFACE_DEFAULTS: Record<GuidanceSurfaceKey, GuidanceSurfaceConfig> = {
  "auth-forgot-help": { autoOpenVisits: 1, critical: true, respectGlobal: false },
  "auth-login-help": { autoOpenVisits: 1, critical: true, respectGlobal: false },
  "auth-register-help": { autoOpenVisits: 1, critical: true, respectGlobal: false },
  "auth-reset-help": { autoOpenVisits: 1, critical: true, respectGlobal: false },
  "auth-verify-help": { autoOpenVisits: 1, critical: true, respectGlobal: false },
  "approvals-flow": { autoOpenVisits: 2, critical: false, respectGlobal: true },
  "attendance-review-flow": { autoOpenVisits: 2, critical: false, respectGlobal: true },
  "dashboard-launch": { autoOpenVisits: 1, critical: false, respectGlobal: true },
  "email-summary-flow": { autoOpenVisits: 1, critical: false, respectGlobal: true },
  "entry-flow": { autoOpenVisits: 2, critical: false, respectGlobal: true },
  "ocr-home-guide": { autoOpenVisits: 2, critical: false, respectGlobal: true },
  "ocr-scan-guide": { autoOpenVisits: 2, critical: false, respectGlobal: true },
  "ocr-verify-guide": { autoOpenVisits: 2, critical: false, respectGlobal: true },
  "reports-flow": { autoOpenVisits: 1, critical: false, respectGlobal: true },
  "settings-flow": { autoOpenVisits: 1, critical: false, respectGlobal: true },
};

function normalizeSurfaceState(value: unknown): StoredSurfaceState {
  if (!value || typeof value !== "object") {
    return { visitCount: 0, manualExpanded: null };
  }

  const candidate = value as Partial<StoredSurfaceState>;
  return {
    visitCount:
      typeof candidate.visitCount === "number" && Number.isFinite(candidate.visitCount)
        ? Math.max(0, Math.floor(candidate.visitCount))
        : 0,
    manualExpanded:
      typeof candidate.manualExpanded === "boolean" ? candidate.manualExpanded : null,
  };
}

function normalizeGuidanceState(value: unknown): StoredGuidanceState {
  if (!value || typeof value !== "object") {
    return DEFAULT_STATE;
  }

  const candidate = value as Partial<StoredGuidanceState>;
  const nextSurfaces: Record<string, StoredSurfaceState> = {};
  if (candidate.surfaces && typeof candidate.surfaces === "object") {
    for (const [key, entry] of Object.entries(candidate.surfaces)) {
      nextSurfaces[key] = normalizeSurfaceState(entry);
    }
  }

  return {
    showTips: typeof candidate.showTips === "boolean" ? candidate.showTips : true,
    surfaces: nextSurfaces,
  };
}

function readGuidanceState(): StoredGuidanceState {
  if (typeof window === "undefined") {
    return DEFAULT_STATE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STATE;
    }
    return normalizeGuidanceState(JSON.parse(raw));
  } catch {
    return DEFAULT_STATE;
  }
}

function writeGuidanceState(state: StoredGuidanceState) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(GUIDANCE_CHANGE_EVENT));
}

function resolveConfig(
  surfaceKey?: GuidanceSurfaceKey | string,
  options?: Partial<GuidanceSurfaceConfig>,
): GuidanceSurfaceConfig {
  const defaults =
    surfaceKey && surfaceKey in SURFACE_DEFAULTS
      ? SURFACE_DEFAULTS[surfaceKey as GuidanceSurfaceKey]
      : { autoOpenVisits: 1, critical: false, respectGlobal: true };

  return {
    autoOpenVisits: options?.autoOpenVisits ?? defaults.autoOpenVisits,
    critical: options?.critical ?? defaults.critical,
    respectGlobal: options?.respectGlobal ?? defaults.respectGlobal,
  };
}

function computeExpanded(
  state: StoredGuidanceState,
  surfaceKey?: GuidanceSurfaceKey | string,
  options?: Partial<GuidanceSurfaceConfig>,
) {
  if (!surfaceKey) {
    return false;
  }

  const config = resolveConfig(surfaceKey, options);
  if (config.respectGlobal && !state.showTips) {
    return false;
  }

  const surface = normalizeSurfaceState(state.surfaces[surfaceKey]);
  if (surface.manualExpanded !== null) {
    return surface.manualExpanded;
  }

  return surface.visitCount <= config.autoOpenVisits;
}

export function useGuidancePreferences(
  surfaceKey?: GuidanceSurfaceKey | string,
  options?: Partial<GuidanceSurfaceConfig>,
) {
  const [state, setState] = useState<StoredGuidanceState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const current = readGuidanceState();
    if (!surfaceKey) {
      const frame = window.requestAnimationFrame(() => {
        setState(current);
        setReady(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const existingSurface = normalizeSurfaceState(current.surfaces[surfaceKey]);
    const next: StoredGuidanceState = {
      ...current,
      surfaces: {
        ...current.surfaces,
        [surfaceKey]: {
          ...existingSurface,
          visitCount: existingSurface.visitCount + 1,
        },
      },
    };

    writeGuidanceState(next);
    const frame = window.requestAnimationFrame(() => {
      setState(next);
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [surfaceKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncState = () => {
      setState(readGuidanceState());
      setReady(true);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        syncState();
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(GUIDANCE_CHANGE_EVENT, syncState);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(GUIDANCE_CHANGE_EVENT, syncState);
    };
  }, []);

  const setShowTips = useCallback((nextShowTips: boolean) => {
    setState((current) => {
      const next = { ...current, showTips: nextShowTips };
      writeGuidanceState(next);
      return next;
    });
    setReady(true);
  }, []);

  const setExpanded = useCallback(
    (nextExpanded: boolean) => {
      if (!surfaceKey) {
        return;
      }

      setState((current) => {
        const surface = normalizeSurfaceState(current.surfaces[surfaceKey]);
        const next = {
          ...current,
          surfaces: {
            ...current.surfaces,
            [surfaceKey]: {
              ...surface,
              manualExpanded: nextExpanded,
            },
          },
        };
        writeGuidanceState(next);
        return next;
      });
      setReady(true);
    },
    [surfaceKey],
  );

  const config = useMemo(() => resolveConfig(surfaceKey, options), [options, surfaceKey]);
  const expanded = ready ? computeExpanded(state, surfaceKey, options) : false;
  const visible = !surfaceKey || !config.respectGlobal || state.showTips || config.critical;

  return {
    ready,
    showTips: state.showTips,
    setShowTips,
    expanded,
    setExpanded,
    visible,
  };
}
