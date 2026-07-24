declare module "heic2any";
declare module "browser-image-compression";
declare module "jspdf-autotable";

// P0-4: Background Sync API — not in TypeScript's DOM lib (non-standard but widely supported)
interface SyncManager {
  register(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}

interface ServiceWorkerRegistration {
  readonly sync: SyncManager;
}
