"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const THEME_STORAGE_KEY = "dpr:web:theme";
const DENSITY_STORAGE_KEY = "dpr:web:density";

export const APP_THEMES = ["dark", "light"] as const;
export const APP_DENSITIES = ["default", "compact", "comfortable"] as const;

export type AppTheme = (typeof APP_THEMES)[number];
export type AppDensity = (typeof APP_DENSITIES)[number];

const DEFAULT_THEME: AppTheme = "dark";
const DEFAULT_DENSITY: AppDensity = "default";

type UiPreferencesContextValue = {
  theme: AppTheme;
  density: AppDensity;
  setTheme: (theme: AppTheme) => void;
  setDensity: (density: AppDensity) => void;
};

const UiPreferencesContext = createContext<UiPreferencesContextValue>({
  theme: DEFAULT_THEME,
  density: DEFAULT_DENSITY,
  setTheme: () => undefined,
  setDensity: () => undefined,
});

function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === "string" && APP_THEMES.includes(value as AppTheme);
}

function isAppDensity(value: unknown): value is AppDensity {
  return typeof value === "string" && APP_DENSITIES.includes(value as AppDensity);
}

function readStoredTheme() {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isAppTheme(stored) ? stored : DEFAULT_THEME;
}

function readStoredDensity() {
  if (typeof window === "undefined") {
    return DEFAULT_DENSITY;
  }
  const stored = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  return isAppDensity(stored) ? stored : DEFAULT_DENSITY;
}

function applyDocumentPreferences(theme: AppTheme, density: AppDensity) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.density = density;
  root.style.colorScheme = theme;
}

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(() => readStoredTheme());
  const [density, setDensity] = useState<AppDensity>(() => readStoredDensity());

  useEffect(() => {
    applyDocumentPreferences(theme, density);

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
  }, [density, theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && isAppTheme(event.newValue)) {
        setTheme(event.newValue);
      }

      if (event.key === DENSITY_STORAGE_KEY && isAppDensity(event.newValue)) {
        setDensity(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      density,
      setTheme,
      setDensity,
    }),
    [density, theme],
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  return useContext(UiPreferencesContext);
}
