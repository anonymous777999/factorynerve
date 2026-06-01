"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { FILTER_THROTTLE_MS, SEARCH_DEBOUNCE_MS } from "@/lib/interaction-timing";

/**
 * React bindings for the interaction timing primitives.
 *
 * Governance reference: Requirement 12.8 - search operations debounce at 300ms,
 * filter operations throttle at 150ms.
 *
 * These hooks implement the timing with refs + setTimeout (matching the existing
 * `use-data-table-route-state` convention) so the returned function is stable
 * across renders, always calls the latest callback, and cleans up on unmount.
 * The pure, framework-agnostic `debounce`/`throttle` helpers in
 * `lib/interaction-timing` carry the same semantics and hold the unit tests.
 */

/**
 * Returns a debounced version of `callback`. The wrapped function runs once,
 * `waitMs` after the last invocation - ideal for search inputs that hit the
 * network. Pending timers are cleared on unmount.
 */
export function useDebouncedCallback<Args extends unknown[]>(
    callback: (...args: Args) => void,
    waitMs: number = SEARCH_DEBOUNCE_MS,
) {
    const callbackRef = useRef(callback);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(
        () => () => {
            if (timeoutRef.current != null) {
                clearTimeout(timeoutRef.current);
            }
        },
        [],
    );

    return useCallback(
        (...args: Args) => {
            if (timeoutRef.current != null) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                timeoutRef.current = null;
                callbackRef.current(...args);
            }, waitMs);
        },
        [waitMs],
    );
}

/**
 * Returns a throttled version of `callback`. The wrapped function runs on the
 * leading edge, then at most once every `waitMs`, with a trailing call so the
 * final arguments always land - ideal for filter inputs over loaded data.
 * Pending timers are cleared on unmount.
 */
export function useThrottledCallback<Args extends unknown[]>(
    callback: (...args: Args) => void,
    waitMs: number = FILTER_THROTTLE_MS,
) {
    const callbackRef = useRef(callback);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRunRef = useRef<number | null>(null);
    const trailingArgsRef = useRef<Args | null>(null);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(
        () => () => {
            if (timeoutRef.current != null) {
                clearTimeout(timeoutRef.current);
            }
        },
        [],
    );

    return useCallback(
        (...args: Args) => {
            const now = Date.now();

            // Leading edge: first call ever, or the previous window has fully elapsed.
            if (lastRunRef.current == null || now - lastRunRef.current >= waitMs) {
                if (timeoutRef.current != null) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
                lastRunRef.current = now;
                callbackRef.current(...args);
                return;
            }

            // Inside the window: remember the latest args and schedule a single
            // trailing call so the final value always lands.
            trailingArgsRef.current = args;
            if (timeoutRef.current == null) {
                const remaining = waitMs - (now - lastRunRef.current);
                timeoutRef.current = setTimeout(() => {
                    timeoutRef.current = null;
                    lastRunRef.current = Date.now();
                    const callArgs = trailingArgsRef.current as Args;
                    trailingArgsRef.current = null;
                    callbackRef.current(...callArgs);
                }, remaining);
            }
        },
        [waitMs],
    );
}

/**
 * Debounces a fast-changing value. The input itself updates immediately; the
 * returned value only settles `waitMs` after the last change. Use the settled
 * value as a React Query key input so the network is hit once per pause instead
 * of once per keystroke.
 */
export function useDebouncedValue<T>(value: T, waitMs: number = SEARCH_DEBOUNCE_MS): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timeoutId = setTimeout(() => setDebouncedValue(value), waitMs);
        return () => clearTimeout(timeoutId);
    }, [value, waitMs]);

    return debouncedValue;
}
