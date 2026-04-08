"use client";

import { useEffect, useState } from "react";

function readStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function useDisplayMode() {
  const [standalone, setStandalone] = useState<boolean>(() => readStandaloneMode());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      setStandalone(readStandaloneMode());
    };

    const media = window.matchMedia?.("(display-mode: standalone)");

    update();
    window.addEventListener("appinstalled", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    media?.addEventListener?.("change", update);

    return () => {
      window.removeEventListener("appinstalled", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      media?.removeEventListener?.("change", update);
    };
  }, []);

  return {
    standalone,
    browser: !standalone,
  };
}
