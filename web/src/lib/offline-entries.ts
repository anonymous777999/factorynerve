export type EntryPayload = {
  date: string;
  shift: "morning" | "evening" | "night";
  client_request_id?: string | null;
  units_target: number;
  units_produced: number;
  manpower_present: number;
  manpower_absent: number;
  downtime_minutes: number;
  downtime_reason?: string | null;
  department?: string | null;
  materials_used?: string | null;
  quality_issues: boolean;
  quality_details?: string | null;
  notes?: string | null;
};

export type TemplateFieldMap = Record<string, string | number | boolean | null>;

export type EntryDraft = Omit<EntryPayload, "client_request_id"> & {
  template_fields?: TemplateFieldMap | null;
};

export type QueuedEntry = {
  id?: number;
  userId?: number | null;
  dedupeKey: string;
  payload: EntryPayload;
  createdAt: string;
  updatedAt: string;
  retries: number;
  lastError?: string | null;
  lastAttemptAt?: string | null;
  conflictEntryId?: number | null;
  status: "pending" | "syncing" | "failed";
};

export type QueueSyncOutcome = {
  status: "sent" | "duplicate";
  entryId?: number | null;
  message?: string;
};

export type QueueFlushResult = {
  sent: number;
  duplicates: number;
  failed: number;
  remaining: number;
  conflictEntryIds: number[];
};

export const ENTRY_QUEUE_UPDATED_EVENT = "dpr:entry-queue-updated";

const DB_NAME = "dpr_offline";
const DB_VERSION = 2;
const DRAFT_STORE = "drafts";
const QUEUE_STORE = "queue";
const QUEUE_SIGNAL_KEY = "dpr:entry-queue-signal";

const isBrowser = typeof window !== "undefined";
const activeFlushes = new Map<string, Promise<QueueFlushResult>>();

function isIndexedDbAvailable() {
  return isBrowser && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      let draftStore: IDBObjectStore;
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        draftStore = db.createObjectStore(DRAFT_STORE);
      } else {
        draftStore = request.transaction!.objectStore(DRAFT_STORE);
      }
      let queueStore: IDBObjectStore;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        queueStore = db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
      } else {
        queueStore = request.transaction!.objectStore(QUEUE_STORE);
      }
      if (!queueStore.indexNames.contains("userId")) {
        queueStore.createIndex("userId", "userId", { unique: false });
      }
      if (!queueStore.indexNames.contains("dedupeKey")) {
        queueStore.createIndex("dedupeKey", "dedupeKey", { unique: false });
      }
      if (!queueStore.indexNames.contains("updatedAt")) {
        queueStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      void draftStore;
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
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

function draftKey(userId?: number | null) {
  return `draft:${userId ?? "anon"}`;
}

function queueKeyForPayload(payload: EntryPayload) {
  return `${payload.date}::${payload.shift}`;
}

function queueMatchesUser(item: QueuedEntry, userId?: number | null) {
  if (userId == null) return true;
  return item.userId == null || item.userId === userId;
}

function notifyQueueChanged(userId?: number | null) {
  if (!isBrowser) return;
  const detail = { userId: userId ?? null, timestamp: new Date().toISOString() };
  window.dispatchEvent(new CustomEvent(ENTRY_QUEUE_UPDATED_EVENT, { detail }));
  try {
    window.localStorage.setItem(QUEUE_SIGNAL_KEY, JSON.stringify(detail));
  } catch {
    // Ignore storage issues; the in-tab custom event is enough.
  }
}

export function subscribeToQueueUpdates(listener: () => void): () => void {
  if (!isBrowser) return () => undefined;

  const onCustomEvent = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === QUEUE_SIGNAL_KEY) {
      listener();
    }
  };

  window.addEventListener(ENTRY_QUEUE_UPDATED_EVENT, onCustomEvent as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ENTRY_QUEUE_UPDATED_EVENT, onCustomEvent as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}

function generateClientRequestId() {
  if (isBrowser && typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `entry_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function withClientRequestId(payload: EntryPayload): EntryPayload {
  if (payload.client_request_id) return payload;
  return {
    ...payload,
    client_request_id: generateClientRequestId(),
  };
}

export async function saveDraft(userId: number | null, draft: EntryDraft): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openDb();
  const tx = db.transaction(DRAFT_STORE, "readwrite");
  tx.objectStore(DRAFT_STORE).put(draft, draftKey(userId));
  await transactionDone(tx);
  notifyQueueChanged(userId);
}

export async function loadDraft(userId: number | null): Promise<EntryDraft | null> {
  if (!isIndexedDbAvailable()) return null;
  const db = await openDb();
  const tx = db.transaction(DRAFT_STORE, "readonly");
  const request = tx.objectStore(DRAFT_STORE).get(draftKey(userId));
  const result = await requestToPromise<EntryDraft | undefined>(request);
  await transactionDone(tx);
  return result ?? null;
}

export async function clearDraft(userId: number | null): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openDb();
  const tx = db.transaction(DRAFT_STORE, "readwrite");
  tx.objectStore(DRAFT_STORE).delete(draftKey(userId));
  await transactionDone(tx);
  notifyQueueChanged(userId);
}

export async function enqueueEntry(userId: number | null, payload: EntryPayload): Promise<QueuedEntry | null> {
  if (!isIndexedDbAvailable()) return null;

  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  const store = tx.objectStore(QUEUE_STORE);
  const items = await requestToPromise<QueuedEntry[]>(store.getAll());
  const ensuredPayload = withClientRequestId(payload);
  const dedupeKey = queueKeyForPayload(ensuredPayload);
  const existing = (items || []).find(
    (item) => queueMatchesUser(item, userId) && item.dedupeKey === dedupeKey,
  );
  const now = new Date().toISOString();

  let nextRecord: QueuedEntry;
  if (existing?.id != null) {
    nextRecord = {
      ...existing,
      userId,
      dedupeKey,
      payload: {
        ...ensuredPayload,
        client_request_id: existing.payload.client_request_id || ensuredPayload.client_request_id,
      },
      updatedAt: now,
      retries: 0,
      lastError: null,
      lastAttemptAt: null,
      conflictEntryId: null,
      status: "pending",
    };
    store.put(nextRecord);
  } else {
    nextRecord = {
      userId,
      dedupeKey,
      payload: ensuredPayload,
      createdAt: now,
      updatedAt: now,
      retries: 0,
      lastError: null,
      lastAttemptAt: null,
      conflictEntryId: null,
      status: "pending",
    };
    store.add(nextRecord);
  }

  await transactionDone(tx);
  notifyQueueChanged(userId);
  return nextRecord;
}

export async function listQueuedEntries(userId: number | null): Promise<QueuedEntry[]> {
  if (!isIndexedDbAvailable()) return [];
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readonly");
  const items = await requestToPromise<QueuedEntry[]>(tx.objectStore(QUEUE_STORE).getAll());
  await transactionDone(tx);
  return (items || [])
    .filter((item) => queueMatchesUser(item, userId))
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
}

export async function countQueuedEntries(userId: number | null): Promise<number> {
  const items = await listQueuedEntries(userId);
  return items.length;
}

export async function deleteQueuedEntry(id: number, userId?: number | null): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  tx.objectStore(QUEUE_STORE).delete(id);
  await transactionDone(tx);
  notifyQueueChanged(userId);
}

async function updateQueueEntry(id: number, patch: Partial<QueuedEntry>): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  const store = tx.objectStore(QUEUE_STORE);
  const existing = await requestToPromise<QueuedEntry | undefined>(store.get(id));
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

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Could not sync queued entry.";
}

export async function flushQueue(
  userId: number | null,
  sender: (payload: EntryPayload, queuedEntry: QueuedEntry) => Promise<QueueSyncOutcome>,
): Promise<QueueFlushResult> {
  const lockKey = String(userId ?? "anon");
  const active = activeFlushes.get(lockKey);
  if (active) {
    return active;
  }

  const run = (async () => {
    const items = await listQueuedEntries(userId);
    let sent = 0;
    let duplicates = 0;
    let failed = 0;
    const conflictEntryIds: number[] = [];

    for (const item of items) {
      if (item.id == null) continue;

      await updateQueueEntry(item.id, {
        status: "syncing",
        lastError: null,
        lastAttemptAt: new Date().toISOString(),
      });

      try {
        const outcome = await sender(item.payload, item);
        if (outcome.status === "duplicate") {
          duplicates += 1;
          if (outcome.entryId) {
            conflictEntryIds.push(outcome.entryId);
          }
        } else {
          sent += 1;
        }
        await deleteQueuedEntry(item.id, item.userId);
      } catch (error) {
        failed += 1;
        await updateQueueEntry(item.id, {
          retries: item.retries + 1,
          lastError: errorMessage(error),
          status: "failed",
          lastAttemptAt: new Date().toISOString(),
        });
      }
    }

    const remaining = await countQueuedEntries(userId);
    return { sent, duplicates, failed, remaining, conflictEntryIds };
  })();

  activeFlushes.set(lockKey, run);
  try {
    return await run;
  } finally {
    activeFlushes.delete(lockKey);
  }
}
