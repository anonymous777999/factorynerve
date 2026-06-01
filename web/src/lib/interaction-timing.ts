/**
 * Interaction timing primitives for Sprint 2 performance optimization.
 *
 * Governance reference: Requirement 12.8 - "THE System SHALL debounce search
 * operations with 300ms delay and filter operations with 150ms delay."
 *
 * These are framework-agnostic helpers so the timing logic can be unit tested
 * in isolation. React bindings live in `hooks/use-interaction-timing.ts`.
 */

/** Standard debounce delay for search operations that trigger API calls. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Standard throttle delay for filter operations over loaded data. */
export const FILTER_THROTTLE_MS = 150;

export type Cancelable = {
    cancel: () => void;
    flush: () => void;
};

export type DebouncedFunction<Args extends unknown[]> = ((...args: Args) => void) & Cancelable;
export type ThrottledFunction<Args extends unknown[]> = ((...args: Args) => void) & Cancelable;

/**
 * Trailing-edge debounce. The wrapped function runs once, `waitMs` after the
 * last invocation. Repeated calls within the window reset the timer so only the
 * final call takes effect - ideal for search inputs that hit the network.
 */
export function debounce<Args extends unknown[]>(
    fn: (...args: Args) => void,
    waitMs: number = SEARCH_DEBOUNCE_MS,
): DebouncedFunction<Args> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pendingArgs: Args | null = null;

    const debounced = (...args: Args) => {
        pendingArgs = args;
        if (timeoutId != null) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            timeoutId = null;
            const callArgs = pendingArgs as Args;
            pendingArgs = null;
            fn(...callArgs);
        }, waitMs);
    };

    debounced.cancel = () => {
        if (timeoutId != null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        pendingArgs = null;
    };

    debounced.flush = () => {
        if (timeoutId != null) {
            clearTimeout(timeoutId);
            timeoutId = null;
            if (pendingArgs != null) {
                const callArgs = pendingArgs;
                pendingArgs = null;
                fn(...callArgs);
            }
        }
    };

    return debounced;
}

/**
 * Leading + trailing throttle. The wrapped function runs immediately on the
 * first call, then at most once every `waitMs`. A trailing call guarantees the
 * final arguments are applied - ideal for filter inputs where the last keystroke
 * must always land while limiting how often expensive filtering re-runs.
 */
export function throttle<Args extends unknown[]>(
    fn: (...args: Args) => void,
    waitMs: number = FILTER_THROTTLE_MS,
): ThrottledFunction<Args> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastRunAt: number | null = null;
    let trailingArgs: Args | null = null;

    const invoke = (args: Args) => {
        lastRunAt = Date.now();
        fn(...args);
    };

    const throttled = (...args: Args) => {
        const now = Date.now();

        // Leading edge: first call ever, or the previous window has fully elapsed.
        if (lastRunAt == null || now - lastRunAt >= waitMs) {
            if (timeoutId != null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            invoke(args);
            return;
        }

        // Inside the window: remember the latest args and schedule a single
        // trailing call so the final value always lands.
        trailingArgs = args;
        if (timeoutId == null) {
            const remaining = waitMs - (now - lastRunAt);
            timeoutId = setTimeout(() => {
                timeoutId = null;
                const callArgs = trailingArgs as Args;
                trailingArgs = null;
                invoke(callArgs);
            }, remaining);
        }
    };

    throttled.cancel = () => {
        if (timeoutId != null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        trailingArgs = null;
        lastRunAt = null;
    };

    throttled.flush = () => {
        if (timeoutId != null) {
            clearTimeout(timeoutId);
            timeoutId = null;
            if (trailingArgs != null) {
                const callArgs = trailingArgs;
                trailingArgs = null;
                invoke(callArgs);
            }
        }
    };

    return throttled;
}
