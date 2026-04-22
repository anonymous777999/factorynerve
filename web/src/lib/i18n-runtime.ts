"use client";

export type NamespaceName =
  | "common"
  | "auth"
  | "navigation"
  | "dashboard"
  | "billing"
  | "analytics"
  | "ai"
  | "attendance"
  | "tasks"
  | "reports"
  | "queue"
  | "settings"
  | "forms"
  | "errors"
  | "notifications";

type LocaleDictionary = Record<string, string>;

type LocaleLoader = () => Promise<LocaleDictionary>;

const NAMESPACES: NamespaceName[] = [
  "common",
  "auth",
  "navigation",
  "dashboard",
  "billing",
  "analytics",
  "ai",
  "attendance",
  "tasks",
  "reports",
  "queue",
  "settings",
  "forms",
  "errors",
  "notifications",
];

const LOCALE_LOADERS: Record<string, Record<NamespaceName, LocaleLoader>> = {
  en: {
    common: () => import("@/locales/en/common.json").then((mod) => mod.default),
    auth: () => import("@/locales/en/auth.json").then((mod) => mod.default),
    navigation: () => import("@/locales/en/navigation.json").then((mod) => mod.default),
    dashboard: () => import("@/locales/en/dashboard.json").then((mod) => mod.default),
    billing: () => import("@/locales/en/billing.json").then((mod) => mod.default),
    analytics: () => import("@/locales/en/analytics.json").then((mod) => mod.default),
    ai: () => import("@/locales/en/ai.json").then((mod) => mod.default),
    attendance: () => import("@/locales/en/attendance.json").then((mod) => mod.default),
    tasks: () => import("@/locales/en/tasks.json").then((mod) => mod.default),
    reports: () => import("@/locales/en/reports.json").then((mod) => mod.default),
    queue: () => import("@/locales/en/queue.json").then((mod) => mod.default),
    settings: () => import("@/locales/en/settings.json").then((mod) => mod.default),
    forms: () => import("@/locales/en/forms.json").then((mod) => mod.default),
    errors: () => import("@/locales/en/errors.json").then((mod) => mod.default),
    notifications: () => import("@/locales/en/notifications.json").then((mod) => mod.default),
  },
  hi: {
    common: () => import("@/locales/hi/common.json").then((mod) => mod.default),
    auth: () => import("@/locales/hi/auth.json").then((mod) => mod.default),
    navigation: () => import("@/locales/hi/navigation.json").then((mod) => mod.default),
    dashboard: () => import("@/locales/hi/dashboard.json").then((mod) => mod.default),
    billing: () => import("@/locales/hi/billing.json").then((mod) => mod.default),
    analytics: () => import("@/locales/hi/analytics.json").then((mod) => mod.default),
    ai: () => import("@/locales/hi/ai.json").then((mod) => mod.default),
    attendance: () => import("@/locales/hi/attendance.json").then((mod) => mod.default),
    tasks: () => import("@/locales/hi/tasks.json").then((mod) => mod.default),
    reports: () => import("@/locales/hi/reports.json").then((mod) => mod.default),
    queue: () => import("@/locales/hi/queue.json").then((mod) => mod.default),
    settings: () => import("@/locales/hi/settings.json").then((mod) => mod.default),
    forms: () => import("@/locales/hi/forms.json").then((mod) => mod.default),
    errors: () => import("@/locales/hi/errors.json").then((mod) => mod.default),
    notifications: () => import("@/locales/hi/notifications.json").then((mod) => mod.default),
  },
  mr: {
    common: () => import("@/locales/mr/common.json").then((mod) => mod.default),
    auth: () => import("@/locales/mr/auth.json").then((mod) => mod.default),
    navigation: () => import("@/locales/mr/navigation.json").then((mod) => mod.default),
    dashboard: () => import("@/locales/mr/dashboard.json").then((mod) => mod.default),
    billing: () => import("@/locales/mr/billing.json").then((mod) => mod.default),
    analytics: () => import("@/locales/mr/analytics.json").then((mod) => mod.default),
    ai: () => import("@/locales/mr/ai.json").then((mod) => mod.default),
    attendance: () => import("@/locales/mr/attendance.json").then((mod) => mod.default),
    tasks: () => import("@/locales/mr/tasks.json").then((mod) => mod.default),
    reports: () => import("@/locales/mr/reports.json").then((mod) => mod.default),
    queue: () => import("@/locales/mr/queue.json").then((mod) => mod.default),
    settings: () => import("@/locales/mr/settings.json").then((mod) => mod.default),
    forms: () => import("@/locales/mr/forms.json").then((mod) => mod.default),
    errors: () => import("@/locales/mr/errors.json").then((mod) => mod.default),
    notifications: () => import("@/locales/mr/notifications.json").then((mod) => mod.default),
  },
  ta: {
    common: () => import("@/locales/ta/common.json").then((mod) => mod.default),
    auth: () => import("@/locales/ta/auth.json").then((mod) => mod.default),
    navigation: () => import("@/locales/ta/navigation.json").then((mod) => mod.default),
    dashboard: () => import("@/locales/ta/dashboard.json").then((mod) => mod.default),
    billing: () => import("@/locales/ta/billing.json").then((mod) => mod.default),
    analytics: () => import("@/locales/ta/analytics.json").then((mod) => mod.default),
    ai: () => import("@/locales/ta/ai.json").then((mod) => mod.default),
    attendance: () => import("@/locales/ta/attendance.json").then((mod) => mod.default),
    tasks: () => import("@/locales/ta/tasks.json").then((mod) => mod.default),
    reports: () => import("@/locales/ta/reports.json").then((mod) => mod.default),
    queue: () => import("@/locales/ta/queue.json").then((mod) => mod.default),
    settings: () => import("@/locales/ta/settings.json").then((mod) => mod.default),
    forms: () => import("@/locales/ta/forms.json").then((mod) => mod.default),
    errors: () => import("@/locales/ta/errors.json").then((mod) => mod.default),
    notifications: () => import("@/locales/ta/notifications.json").then((mod) => mod.default),
  },
  gu: {
    common: () => import("@/locales/gu/common.json").then((mod) => mod.default),
    auth: () => import("@/locales/gu/auth.json").then((mod) => mod.default),
    navigation: () => import("@/locales/gu/navigation.json").then((mod) => mod.default),
    dashboard: () => import("@/locales/gu/dashboard.json").then((mod) => mod.default),
    billing: () => import("@/locales/gu/billing.json").then((mod) => mod.default),
    analytics: () => import("@/locales/gu/analytics.json").then((mod) => mod.default),
    ai: () => import("@/locales/gu/ai.json").then((mod) => mod.default),
    attendance: () => import("@/locales/gu/attendance.json").then((mod) => mod.default),
    tasks: () => import("@/locales/gu/tasks.json").then((mod) => mod.default),
    reports: () => import("@/locales/gu/reports.json").then((mod) => mod.default),
    queue: () => import("@/locales/gu/queue.json").then((mod) => mod.default),
    settings: () => import("@/locales/gu/settings.json").then((mod) => mod.default),
    forms: () => import("@/locales/gu/forms.json").then((mod) => mod.default),
    errors: () => import("@/locales/gu/errors.json").then((mod) => mod.default),
    notifications: () => import("@/locales/gu/notifications.json").then((mod) => mod.default),
  },
};

const localeCache = new Map<string, LocaleDictionary>();
const localePromises = new Map<string, Promise<LocaleDictionary>>();
const revisionListeners = new Set<() => void>();
const namespaceValidationWarnings = new Set<string>();

function cacheKey(language: string, namespace: NamespaceName) {
  return `${language}:${namespace}`;
}

function notifyRevisionListeners() {
  revisionListeners.forEach((listener) => listener());
}

function getEnglishKeys(namespace: NamespaceName) {
  const english = localeCache.get(cacheKey("en", namespace));
  return english ? Object.keys(english).sort() : null;
}

function validateDictionaryShape(language: string, namespace: NamespaceName, dictionary: LocaleDictionary) {
  if (process.env.NODE_ENV === "production" || language === "en") {
    return;
  }

  const englishKeys = getEnglishKeys(namespace);
  if (!englishKeys) {
    return;
  }

  const dictionaryKeys = Object.keys(dictionary).sort();
  const englishKeySet = new Set(englishKeys);
  const dictionaryKeySet = new Set(dictionaryKeys);
  const missing = englishKeys.filter((key) => !dictionaryKeySet.has(key));
  const extras = dictionaryKeys.filter((key) => !englishKeySet.has(key));

  if (!missing.length && !extras.length) {
    return;
  }

  const warningKey = `${language}:${namespace}`;
  if (namespaceValidationWarnings.has(warningKey)) {
    return;
  }
  namespaceValidationWarnings.add(warningKey);
  console.warn(`[i18n] Locale shape mismatch for ${warningKey}`, {
    missing,
    extras,
  });
}

async function loadDictionary(language: string, namespace: NamespaceName) {
  const key = cacheKey(language, namespace);
  const cached = localeCache.get(key);
  if (cached) {
    return cached;
  }

  const pending = localePromises.get(key);
  if (pending) {
    return pending;
  }

  const loaders = LOCALE_LOADERS[language] || LOCALE_LOADERS.en;
  const loader = loaders?.[namespace] || LOCALE_LOADERS.en[namespace];
  const promise = loader()
    .then((dictionary) => {
      localeCache.set(key, dictionary);
      validateDictionaryShape(language, namespace, dictionary);
      notifyRevisionListeners();
      return dictionary;
    })
    .finally(() => {
      localePromises.delete(key);
    });

  localePromises.set(key, promise);
  return promise;
}

export function subscribeTranslationRevision(listener: () => void) {
  revisionListeners.add(listener);
  return () => {
    revisionListeners.delete(listener);
  };
}

export async function ensureNamespacesLoaded(language: string, namespaces: NamespaceName[]) {
  await Promise.all(namespaces.map((namespace) => loadDictionary(language, namespace)));
}

export function preloadNamespaces(language: string, namespaces: NamespaceName[]) {
  void ensureNamespacesLoaded(language, namespaces);
}

export function getNamespaceTranslation(language: string, key: string) {
  for (const namespace of NAMESPACES) {
    const dictionary = localeCache.get(cacheKey(language, namespace));
    if (dictionary && key in dictionary) {
      return dictionary[key];
    }
  }
  return undefined;
}

export function hasTranslation(language: string, key: string) {
  return typeof getNamespaceTranslation(language, key) === "string";
}

export function detectBrowserLanguage(validLanguages: readonly string[], fallback = "en") {
  if (typeof navigator === "undefined") {
    return fallback;
  }

  const candidates = [...(navigator.languages || []), navigator.language].filter(Boolean);
  for (const candidate of candidates) {
    const normalized = String(candidate).toLowerCase();
    const exact = validLanguages.find((language) => language === normalized);
    if (exact) {
      return exact;
    }
    const base = normalized.split("-")[0];
    const match = validLanguages.find((language) => language === base);
    if (match) {
      return match;
    }
  }

  return fallback;
}
