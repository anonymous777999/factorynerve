"use client";

import { useEffect, useState } from "react";

function detectMobileOcrDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const narrow = window.innerWidth < 900;
  const mobileUserAgent =
    /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent || "");

  return coarse || narrow || mobileUserAgent;
}

export function useOcrDevice() {
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const update = () => {
      setIsMobile(detectMobileOcrDevice());
      setReady(true);
    };

    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
    };
  }, []);

  return {
    isMobile,
    ready,
  };
}

