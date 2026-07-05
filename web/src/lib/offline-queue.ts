"use client";

/**
 * P0-4: General-purpose offline mutation queue.
 *
 * Supports queuing any mutation operation (attendance punch, dispatch creation,
 * production batch, inventory transaction) and flushing them when online.
 * Uses IndexedDB for persistence so queued operations survive page reloads.
 *
 * Architecture:
 *   Operation -> store.dispatch(operation) -> IndexedDB queue -> Background sync
 *   -> Service Worker -> fetch() -> backend -> success callback -> dequeue
 *
 * Each operation has:
 *   - id: auto-increment primary key
 *   - type: string action type (e.g. "attendance.punch", "dispatch.create")
 *   - payload: JSON-serializable data for the API call
 *   - endpoint: API endpoint path (e.g. "/api/attendance/punch")
 *   - method: HTTP method (POST, PUT, DELETE)
 *   - dedupeKey: unique key for idempotency
 *   - status: "pending" | "syncing" | "failed"
 *   - retries: number of retry attempts
 *   - createdAt/updatedAt: timestamps
 */

const DB_NAME = "dpr_mutation_queue";
const DB_VERSION = 1;
const STORE_NAME = "mutations";
const SIGNAL_KEY = "dpr:mutation-queue-signal";
const MUTATION_QUEUE_UPDATED = "dpr:mutation-queue-updated";

const isBrowser = typeof window !== "undefined";

// ── Types ─────────────────────────────────────────────────────────────────

export type MutationMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export type MutationOperation = {
  type: string;
  endpoint: string;
  method: MutationMethod;
  payload: unknown;
  dedupeKey: string;
};

export type QueuedMutation = MutationOperation & {
  id?: number;
  userId?: number | null;
  status: "pending" | "syncing" | "failed";
  retries: number;
  maxRetries: number;
  lastError?: string | null;
  lastAttemptAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MutationFlushResult = {
  sent: number;
  failed: number;
  remaining: number;
};

// ── IndexedDB helpers ────────────────────────────────────────────────────

function isAvailable() {
  return isBrowser && "indexedDB" in window && "caches" in window;
}

function openDb(): Promise<IDBDatabase> {
  if (!isAvailable()) {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("dedupeKey", "dedupeKey", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB request failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
}

function generateDedupeKey(operation: MutationOperation): string {
  if (operation.dedupeKey) return operation.dedupeKey;
  return `${operation.type}::${operation.endpoint}::${Date.now()}`;
}

function notify() {
  if (!isBrowser) return;
  window.dispatchEvent(new CustomEvent(MUTATION_QUEUE_UPDATED, { detail: { timestamp: new Date().toISOString() } }));
  try {
    window.localStorage.setItem(SIGNAL_KEY, JSON.stringify({ timestamp: new Date().toISOString() }));
  } catch {
    // ignore
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export function subscribe(listener: () => void): () => void {
  if (!isBrowser) return () => undefined;
  const onEvent = () => listener();
  const onStorage = (e: StorageEvent) => {
    if (e.key === SIGNAL_KEY) listener();
  };
  window.addEventListener(MUTATION_QUEUE_UPDATED, onEvent as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MUTATION_QUEUE_UPDATED, onEvent as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}

export async function enqueue(
  operation: MutationOperation,
  userId?: number | null,
): Promise<QueuedMutation | null> {
  if (!isAvailable()) return null;

  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  // Check for existing by dedupe key
  const all = await reqToPromise<QueuedMutation[]>(store.getAll());
  const dedupeKey = generateDedupeKey(operation);
  const existing = (all || []).find((item) => item.dedupeKey === dedupeKey);
  const now = new Date().toISOString();

  let record: QueuedMutation;
  if (existing?.id != null) {
    record = {
      ...existing,
      userId,
      payload: operation.payload,
      status: "pending",
      retries: 0,
      lastError: null,
      lastAttemptAt: null,
      updatedAt: now,
    };
    store.put(record);
  } else {
    record = {
      type: operation.type,
      endpoint: operation.endpoint,
      method: operation.method,
      payload: operation.payload,
      dedupeKey,
      userId,
      status: "pending",
      retries: 0,
      maxRetries: 5,
      lastError: null,
      lastAttemptAt: null,
      createdAt: now,
      updatedAt: now,
    };
    store.add(record);
  }

  await txDone(tx);
  notify();

  // P0-4: Try to register for background sync so the service worker replays
  // queued mutations when the browser detects connectivity restored.
  if (isBrowser && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((registration) => {
      if ("sync" in registration) {
        registration.sync.register("sync-mutations").catch(() => undefined);
      }
    }).catch(() => undefined);
  }

  return record;
}

export async function listAll(userId?: number | null): Promise<QueuedMutation[]> {
  if (!isAvailable()) return [];
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const items = await reqToPromise<QueuedMutation[]>(tx.objectStore(STORE_NAME).getAll());
  await txDone(tx);
  return (items || [])
    .filter((item) => !userId || item.userId == null || item.userId === userId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function countPending(userId?: number | null): Promise<number> {
  const items = await listAll(userId);
  return items.filter((i) => i.status !== "syncing").length;
}

export async function remove(id: number): Promise<void> {
  if (!isAvailable()) return;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  await txDone(tx);
  notify();
}

async function update(id: number, patch: Partial<QueuedMutation>): Promise<void> {
  if (!isAvailable()) return;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const existing = await reqToPromise<QueuedMutation | undefined>(store.get(id));
  if (existing) {
    store.put({ ...existing, ...patch, updatedAt: new Date().toISOString() });
  }
  await txDone(tx);
  notify();
}

export type SendMutation = (
  item: QueuedMutation,
) => Promise<{ ok: boolean; error?: string }>;

export async function flushAll(
  userId: number | null,
  sender: SendMutation,
): Promise<MutationFlushResult> {
  const items = await listAll(userId);
  let sent = 0;
  let failed = 0;

  for (const item of items) {
    if (item.id == null) continue;
    if (item.retries >= item.maxRetries) continue;

    await update(item.id, {
      status: "syncing",
      lastAttemptAt: new Date().toISOString(),
    });

    try {
      const result = await sender(item);
      if (result.ok) {
        sent += 1;
        await remove(item.id);
      } else {
        failed += 1;
        await update(item.id, {
          status: "failed",
          retries: item.retries + 1,
          lastError: result.error || "Unknown error",
        });
      }
    } catch (error) {
      failed += 1;
      await update(item.id, {
        status: "failed",
        retries: item.retries + 1,
        lastError: error instanceof Error ? error.message : "Network error",
      });
    }
  }

  const remaining = await countPending(userId);
  return { sent, failed, remaining };
}

export async function clearAllFailed(userId?: number | null): Promise<void> {
  if (!isAvailable()) return;
  const items = await listAll(userId);
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  for (const item of items) {
    if (item.status === "failed" && item.id != null) {
      store.delete(item.id);
    }
  }
  await txDone(tx);
  notify();
}

export async function getQueueSummary(userId?: number | null): Promise<{
  total: number;
  pending: number;
  syncing: number;
  failed: number;
}> {
  const items = await listAll(userId);
  return {
    total: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    syncing: items.filter((i) => i.status === "syncing").length,
    failed: items.filter((i) => i.status === "failed").length,
  };
}
