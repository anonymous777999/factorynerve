"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * P0-4: Hook that tracks browser online/offline status.
 *
 * Returns:
 * - isOnline: true when navigator.onLine is true
 * - isOffline: true when navigator.onLine is false
 * - wasOffline: true for 3 seconds after reconnecting (useful for animations/toasts)
 */

function getOnlineStatus(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function useOfflineStatus(): {
  isOnline: boolean;
  isOffline: boolean;
  wasOffline: boolean;
} {
  const [isOnline, setIsOnline] = useState(getOnlineStatus);
  const [wasOffline, setWasOffline] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setWasOffline(true);
    // Keep wasOffline true for 3 seconds for animation/notification purposes
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setWasOffline(false);
    }, 3000);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setWasOffline(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // Set initial state
    if (!getOnlineStatus()) {
      setIsOnline(false);
    }
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, isOffline: !isOnline, wasOffline };
}
