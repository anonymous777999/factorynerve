const BUILD_VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_PREFIX = "dpr-shell-";
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ── Workbox (P0-4) ───────────────────────────────────────────────────────
// Load workbox-sw from CDN for robust caching strategies
importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");

const wb = self.workbox;

// ── Install: precache offline shell assets ────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: clean old caches ────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Path helpers ──────────────────────────────────────────────────────────

function isServiceWorkerBypassedPath(url) {
  if (url.pathname.startsWith("/api/auth/")) return true;
  if (url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")) return true;
  if (url.pathname === "/entry" || url.pathname.startsWith("/entry/")) return true;
  return false;
}

function isRuntimeAsset(request, url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/icons/")) return true;
  return ["style", "script", "worker", "font"].includes(request.destination);
}

// ── Background sync queue for offline mutations (P0-4) ──────────────────

const SYNC_CACHE = "dpr-sync-queue";

/**
 * Store a failed POST/PUT/PATCH/DELETE request for later replay.
 */
function cacheFailedMutation(request, body) {
  // Only cache mutations that are safe to replay
  const url = new URL(request.url);
  if (request.method === "GET") return;

  caches.open(SYNC_CACHE).then((cache) => {
    const key = `${Date.now()}-${request.method}-${url.pathname}`;
    const headers = {};
    request.headers.forEach((value, name) => {
      if (name.toLowerCase() !== "authorization") {
        headers[name] = value;
      }
    });
    const entry = new Response(
      JSON.stringify({
        method: request.method,
        path: url.pathname,
        headers,
        body: body || null,
        timestamp: Date.now(),
      }),
      { headers: { "content-type": "application/json" } },
    );
    cache.put(key, entry);
  });
}

/**
 * Replay all cached mutations in order, oldest first.
 * Called by the sync event when the browser fires background sync.
 */
async function replayMutations() {
  const cache = await caches.open(SYNC_CACHE);
  const keys = await cache.keys();
  // Keys are prefixed with Date.now(), so sorting lexicographically = chronological
  keys.sort((a, b) => a.url.localeCompare(b.url));

  for (const key of keys) {
    try {
      const entry = await cache.match(key);
      if (!entry) continue;

      const data = await entry.json();
      const fetchOptions = {
        method: data.method || "POST",
        headers: data.headers || { "Content-Type": "application/json" },
        // data.body is already a raw string from cacheFailedMutation's JSON.stringify envelope
        body: data.body || undefined,
      };

      const response = await fetch(data.path, fetchOptions);
      if (response.ok || response.status === 409) {
        // 409 Conflict (duplicate) — safe to delete
        await cache.delete(key);
      } else if (response.status >= 400 && response.status < 500) {
        // Client error — won't succeed on retry, delete to avoid infinite loops
        await cache.delete(key);
      }
      // 5xx errors stay in queue for next sync event
    } catch {
      // Network still down — next sync event will retry
    }
  }
}

// ── Background sync event (P0-4) ─────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-mutations") {
    event.waitUntil(replayMutations());
  }
});

// ── Workbox route registrations (P0-4) ───────────────────────────────────

if (wb) {
  // Next.js static assets (_next/static/*) — CacheFirst with 30-day expiry
  wb.routing.registerRoute(
    /\/_next\/static\/.*/,
    new wb.strategies.CacheFirst({
      cacheName: `${CACHE_NAME}-static`,
      plugins: [
        new wb.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new wb.expiration.ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      ],
    }),
  );

  // Fonts — CacheFirst with 90-day expiry
  wb.routing.registerRoute(
    /\.(woff2|woff|ttf|eot)$/,
    new wb.strategies.CacheFirst({
      cacheName: `${CACHE_NAME}-fonts`,
      plugins: [
        new wb.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new wb.expiration.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 90 * 24 * 60 * 60 }),
      ],
    }),
  );

  // Icons — CacheFirst with 90-day expiry
  wb.routing.registerRoute(
    /\/icons\/.*/,
    new wb.strategies.CacheFirst({
      cacheName: `${CACHE_NAME}-icons`,
      plugins: [
        new wb.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new wb.expiration.ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 90 * 24 * 60 * 60 }),
      ],
    }),
  );

  // Navigation requests (HTML pages) — NetworkFirst with /offline fallback
  wb.routing.registerRoute(
    ({ request }) => request.mode === "navigate",
    new wb.strategies.NetworkFirst({
      cacheName: `${CACHE_NAME}-pages`,
      plugins: [
        new wb.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
      ],
    }),
  );
}

// ── Fetch event (non-workbox paths) ──────────────────────────────────────

self.addEventListener("fetch", (event) => {
  // Skip non-GET mutations — handle them with body capture + background sync
  if (event.request.method !== "GET") {
    // Read the body BEFORE the try/catch so we can cache it on failure (P0-4 fix)
    const bodyPromise = event.request.clone().text().catch(() => null);

    event.respondWith(
      bodyPromise.then((body) => {
        return fetch(event.request).catch(() => {
          // Network failed — cache the mutation for background sync replay
          cacheFailedMutation(event.request, body);
          return new Response(
            JSON.stringify({
              offline: true,
              queued: true,
              message: "Request queued for sync when back online.",
            }),
            {
              status: 202,
              headers: { "Content-Type": "application/json", "X-Offline-Queued": "true" },
            },
          );
        });
      }),
    );
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (isServiceWorkerBypassedPath(url)) return;

  // API GET requests: network-only (no caching)
  if (url.pathname.startsWith("/api/")) return;

  // All non-workbox GET requests fall through to default
});
