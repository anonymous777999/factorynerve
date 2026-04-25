"use client";

import type { SubmitFeedbackPayload } from "@/lib/feedback";

export type QueuedFeedback = {
  id?: number;
  userId?: number | null;
  clientRequestId: string;
  payload: SubmitFeedbackPayload;
  createdAt: string;
  updatedAt: string;
  retries: number;
  lastError?: string | null;
  lastAttemptAt?: string | null;
  status: "pending" | "syncing" | "failed";
};

export const FEEDBACK_QUEUE_UPDATED_EVENT = "dpr:feedback-queue-updated";

const DB_NAME = "dpr_feedback_offline";
const DB_VERSION = 1;
const QUEUE_STORE = "queue";
const QUEUE_SIGNAL_KEY = "dpr:feedback-queue-signal";

const isBrowser = typeof window !== "undefined";
const activeFlushes = new Map<string, Promise<number>>();

function isIndexedDbAvailable() {
  return isBrowser && "indexedDB" in window;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

function openDb(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      let queueStore: IDBObjectStore;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        queueStore = db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
      } else {
        queueStore = request.transaction!.objectStore(QUEUE_STORE);
      }
      if (!queueStore.indexNames.contains("userId")) {
        queueStore.createIndex("userId", "userId", { unique: false });
      }
      if (!queueStore.indexNames.contains("clientRequestId")) {
        queueStore.createIndex("clientRequestId", "clientRequestId", { unique: false });
      }
      if (!queueStore.indexNames.contains("updatedAt")) {
        queueStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

function notifyQueueChanged(userId?: number | null) {
  if (!isBrowser) return;
  const detail = { userId: userId ?? null, timestamp: new Date().toISOString() };
  window.dispatchEvent(new CustomEvent(FEEDBACK_QUEUE_UPDATED_EVENT, { detail }));
  try {
    window.localStorage.setItem(QUEUE_SIGNAL_KEY, JSON.stringify(detail));
  } catch {
    // Ignore storage issues; custom event is enough in-tab.
  }
}

export function subscribeToFeedbackQueueUpdates(listener: () => void): () => void {
  if (!isBrowser) return () => undefined;

  const onCustomEvent = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === QUEUE_SIGNAL_KEY) {
      listener();
    }
  };

  window.addEventListener(FEEDBACK_QUEUE_UPDATED_EVENT, onCustomEvent as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(FEEDBACK_QUEUE_UPDATED_EVENT, onCustomEvent as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}

function queueMatchesUser(item: QueuedFeedback, userId?: number | null) {
  if (userId == null) return true;
  return item.userId == null || item.userId === userId;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Could not sync queued feedback.";
}

function generateClientRequestId() {
  if (isBrowser && typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function withFeedbackClientRequestId(payload: SubmitFeedbackPayload): SubmitFeedbackPayload {
  if (payload.client_request_id) return payload;
  return {
    ...payload,
    client_request_id: generateClientRequestId(),
  };
}

export async function enqueueFeedback(
  userId: number | null,
  payload: SubmitFeedbackPayload,
): Promise<QueuedFeedback | null> {
  if (!isIndexedDbAvailable()) return null;

  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  const store = tx.objectStore(QUEUE_STORE);
  const items = await requestToPromise<QueuedFeedback[]>(store.getAll());
  const ensuredPayload = withFeedbackClientRequestId(payload);
  const clientRequestId = ensuredPayload.client_request_id!;
  const existing = (items || []).find(
    (item) => queueMatchesUser(item, userId) && item.clientRequestId === clientRequestId,
  );
  const now = new Date().toISOString();

  let nextRecord: QueuedFeedback;
  if (existing?.id != null) {
    nextRecord = {
      ...existing,
      userId,
      clientRequestId,
      payload: ensuredPayload,
      updatedAt: now,
      retries: existing.retries,
      lastError: null,
      lastAttemptAt: null,
      status: "pending",
    };
    store.put(nextRecord);
  } else {
    nextRecord = {
      userId,
      clientRequestId,
      payload: ensuredPayload,
      createdAt: now,
      updatedAt: now,
      retries: 0,
      lastError: null,
      lastAttemptAt: null,
      status: "pending",
    };
    store.add(nextRecord);
  }

  await transactionDone(tx);
  notifyQueueChanged(userId);
  return nextRecord;
}

export async function listQueuedFeedback(userId: number | null): Promise<QueuedFeedback[]> {
  if (!isIndexedDbAvailable()) return [];
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readonly");
  const items = await requestToPromise<QueuedFeedback[]>(tx.objectStore(QUEUE_STORE).getAll());
  await transactionDone(tx);
  return (items || [])
    .filter((item) => queueMatchesUser(item, userId))
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
}

export async function countQueuedFeedback(userId: number | null): Promise<number> {
  const items = await listQueuedFeedback(userId);
  return items.length;
}

async function deleteQueuedFeedback(id: number, userId?: number | null): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  tx.objectStore(QUEUE_STORE).delete(id);
  await transactionDone(tx);
  notifyQueueChanged(userId);
}

async function updateQueuedFeedback(id: number, patch: Partial<QueuedFeedback>): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  const store = tx.objectStore(QUEUE_STORE);
  const existing = await requestToPromise<QueuedFeedback | undefined>(store.get(id));
  if (existing) {
    store.put({
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  }
  await transactionDone(tx);
  notifyQueueChanged(existing?.userId);
}

export async function flushQueuedFeedback(
  userId: number | null,
  sender: (payload: SubmitFeedbackPayload, queuedItem: QueuedFeedback) => Promise<void>,
): Promise<number> {
  const lockKey = String(userId ?? "anon");
  const active = activeFlushes.get(lockKey);
  if (active) {
    return active;
  }

  const run = (async () => {
    const items = await listQueuedFeedback(userId);
    let sent = 0;

    for (const item of items) {
      if (item.id == null) continue;

      await updateQueuedFeedback(item.id, {
        status: "syncing",
        lastError: null,
        lastAttemptAt: new Date().toISOString(),
      });

      try {
        await sender(item.payload, item);
        sent += 1;
        await deleteQueuedFeedback(item.id, item.userId);
      } catch (error) {
        await updateQueuedFeedback(item.id, {
          retries: item.retries + 1,
          lastError: errorMessage(error),
          status: "failed",
          lastAttemptAt: new Date().toISOString(),
        });
      }
    }

    return sent;
  })();

  activeFlushes.set(lockKey, run);
  try {
    return await run;
  } finally {
    activeFlushes.delete(lockKey);
  }
}
