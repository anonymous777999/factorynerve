"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe media-query hook. Returns `false` on the server and on first client
 * paint, then updates after mount so hydration never mismatches. Prefer this
 * over reading `window.innerWidth` directly (which is not reactive and throws
 * during SSR).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

// Aligned to the Tailwind default breakpoints (sm 640, md 768, lg 1024, xl 1280).
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/**
 * Convenience wrapper returning semantic booleans. Mobile-first: `isMobile` is
 * true below `md`, `isTablet` covers md–lg, `isDesktop` is lg+, `isWide` is xl+.
 */
export function useBreakpoint() {
  const isMdUp = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px)`);
  const isLgUp = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
  const isXlUp = useMediaQuery(`(min-width: ${BREAKPOINTS.xl}px)`);
  return {
    isMobile: !isMdUp,
    isTablet: isMdUp && !isLgUp,
    isDesktop: isLgUp,
    isWide: isXlUp,
  };
}
