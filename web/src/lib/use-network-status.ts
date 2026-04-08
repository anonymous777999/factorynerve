"use client";

import { useEffect, useState } from "react";

type ConnectionWithListeners = {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
};

type NetworkStatus = {
  online: boolean;
  constrained: boolean;
  effectiveType: string | null;
  saveData: boolean;
};

type NavigatorWithConnection = Navigator & {
  connection?: ConnectionWithListeners;
  mozConnection?: ConnectionWithListeners;
  webkitConnection?: ConnectionWithListeners;
};

function readConnection(): ConnectionWithListeners | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as NavigatorWithConnection;
  return nav.connection || nav.mozConnection || nav.webkitConnection || null;
}

function isConstrainedConnection(connection: ConnectionWithListeners | null, online: boolean) {
  if (!online || !connection) return false;
  const effectiveType = String(connection.effectiveType || "").toLowerCase();
  return Boolean(connection.saveData) || ["slow-2g", "2g", "3g"].includes(effectiveType);
}

function snapshot(): NetworkStatus {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const connection = readConnection();
  return {
    online,
    constrained: isConstrainedConnection(connection, online),
    effectiveType: connection?.effectiveType || null,
    saveData: Boolean(connection?.saveData),
  };
}

export function useNetworkStatus() {
  const [state, setState] = useState<NetworkStatus>(() => snapshot());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => setState(snapshot());
    const connection = readConnection();

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    connection?.addEventListener?.("change", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      connection?.removeEventListener?.("change", update);
    };
  }, []);

  return state;
}
