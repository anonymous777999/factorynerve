const WORKFLOW_REFRESH_STORAGE_KEY = "dpr:workflow-refresh-signal";

export const WORKFLOW_REFRESH_EVENT = "dpr:workflow-refresh";

type WorkflowRefreshDetail = {
  source?: string;
  timestamp: string;
};

const isBrowser = typeof window !== "undefined";

export function signalWorkflowRefresh(source?: string) {
  if (!isBrowser) return;
  const detail: WorkflowRefreshDetail = {
    source,
    timestamp: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent(WORKFLOW_REFRESH_EVENT, { detail }));
  try {
    window.localStorage.setItem(WORKFLOW_REFRESH_STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // Ignore storage issues; the in-tab event is enough for same-session refresh.
  }
}

export function subscribeToWorkflowRefresh(listener: () => void): () => void {
  if (!isBrowser) return () => undefined;

  const onCustomEvent = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === WORKFLOW_REFRESH_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(WORKFLOW_REFRESH_EVENT, onCustomEvent as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(WORKFLOW_REFRESH_EVENT, onCustomEvent as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
