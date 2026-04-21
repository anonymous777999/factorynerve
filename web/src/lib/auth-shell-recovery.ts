"use client";

const AUTH_RECOVERY_KEY = "factorynerve-auth-shell-recovery-at";
const AUTH_RECOVERY_EMAIL_KEY = "factorynerve-auth-shell-recovery-email";
const AUTH_RECOVERY_WINDOW_MS = 5 * 60 * 1000;
const CACHE_PREFIXES = ["factorynerve-shell-", "factorynerve-static-", "factorynerve-runtime-"];

function shouldThrottleRecovery() {
  if (typeof window === "undefined") return true;
  const lastAttempt = Number(window.sessionStorage.getItem(AUTH_RECOVERY_KEY) || 0);
  return Number.isFinite(lastAttempt) && lastAttempt > 0 && Date.now() - lastAttempt < AUTH_RECOVERY_WINDOW_MS;
}

export function consumeRecoveredLoginEmail() {
  if (typeof window === "undefined") return "";
  const email = window.sessionStorage.getItem(AUTH_RECOVERY_EMAIL_KEY) || "";
  if (email) {
    window.sessionStorage.removeItem(AUTH_RECOVERY_EMAIL_KEY);
  }
  return email;
}

export async function clearAuthShellArtifacts() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
  await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));

  if ("caches" in window) {
    const keys = await window.caches.keys().catch(() => []);
    await Promise.all(
      keys
        .filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
        .map((key) => window.caches.delete(key).catch(() => false)),
    );
  }
}

export async function attemptAuthShellRecovery(email?: string) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  if (!navigator.onLine || shouldThrottleRecovery()) return false;

  window.sessionStorage.setItem(AUTH_RECOVERY_KEY, String(Date.now()));
  if (email?.trim()) {
    window.sessionStorage.setItem(AUTH_RECOVERY_EMAIL_KEY, email.trim());
  }

  try {
    await clearAuthShellArtifacts();
  } finally {
    window.setTimeout(() => {
      window.location.reload();
    }, 120);
  }

  return true;
}
