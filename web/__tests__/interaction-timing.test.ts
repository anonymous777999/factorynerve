import assert from "node:assert/strict";
import test, { mock } from "node:test";

import {
    debounce,
    FILTER_THROTTLE_MS,
    SEARCH_DEBOUNCE_MS,
    throttle,
} from "../src/lib/interaction-timing.ts";

test("default delays match Requirement 12.8 (search 300ms / filter 150ms)", () => {
    assert.equal(SEARCH_DEBOUNCE_MS, 300);
    assert.equal(FILTER_THROTTLE_MS, 150);
});

test("debounce only runs once after the last call within the window", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
        const calls: string[] = [];
        const debounced = debounce((value: string) => calls.push(value), SEARCH_DEBOUNCE_MS);

        debounced("a");
        mock.timers.tick(100);
        debounced("b");
        mock.timers.tick(100);
        debounced("c");

        // Not enough idle time has passed yet.
        mock.timers.tick(299);
        assert.deepEqual(calls, []);

        // Crossing the 300ms idle boundary fires once with the latest args.
        mock.timers.tick(1);
        assert.deepEqual(calls, ["c"]);
    } finally {
        mock.timers.reset();
    }
});

test("debounce waits a full window after the final keystroke", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
        const calls: string[] = [];
        const debounced = debounce((value: string) => calls.push(value), SEARCH_DEBOUNCE_MS);

        debounced("steel");
        mock.timers.tick(SEARCH_DEBOUNCE_MS);
        assert.deepEqual(calls, ["steel"]);

        // A later call starts a fresh window.
        debounced("steel-batch");
        mock.timers.tick(SEARCH_DEBOUNCE_MS - 1);
        assert.deepEqual(calls, ["steel"]);
        mock.timers.tick(1);
        assert.deepEqual(calls, ["steel", "steel-batch"]);
    } finally {
        mock.timers.reset();
    }
});

test("debounce.cancel prevents a pending invocation", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
        const calls: string[] = [];
        const debounced = debounce((value: string) => calls.push(value), SEARCH_DEBOUNCE_MS);

        debounced("pending");
        debounced.cancel();
        mock.timers.tick(SEARCH_DEBOUNCE_MS * 2);
        assert.deepEqual(calls, []);
    } finally {
        mock.timers.reset();
    }
});

test("throttle runs immediately on the leading edge", () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"] });
    try {
        const calls: string[] = [];
        const throttled = throttle((value: string) => calls.push(value), FILTER_THROTTLE_MS);

        throttled("first");
        assert.deepEqual(calls, ["first"]);
    } finally {
        mock.timers.reset();
    }
});

test("throttle limits to one trailing call per window and keeps the last value", () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"] });
    try {
        const calls: string[] = [];
        const throttled = throttle((value: string) => calls.push(value), FILTER_THROTTLE_MS);

        throttled("a"); // leading edge fires immediately
        throttled("b"); // queued as trailing
        throttled("c"); // overwrites trailing args
        assert.deepEqual(calls, ["a"]);

        // Trailing call lands once the window elapses, using the most recent value.
        mock.timers.tick(FILTER_THROTTLE_MS);
        assert.deepEqual(calls, ["a", "c"]);
    } finally {
        mock.timers.reset();
    }
});

test("throttle allows a fresh leading call after the window passes", () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"] });
    try {
        const calls: string[] = [];
        const throttled = throttle((value: string) => calls.push(value), FILTER_THROTTLE_MS);

        throttled("one");
        assert.deepEqual(calls, ["one"]);

        mock.timers.tick(FILTER_THROTTLE_MS + 1);
        throttled("two");
        assert.deepEqual(calls, ["one", "two"]);
    } finally {
        mock.timers.reset();
    }
});

test("throttle.cancel drops a pending trailing call", () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"] });
    try {
        const calls: string[] = [];
        const throttled = throttle((value: string) => calls.push(value), FILTER_THROTTLE_MS);

        throttled("a");
        throttled("b");
        throttled.cancel();
        mock.timers.tick(FILTER_THROTTLE_MS * 2);
        assert.deepEqual(calls, ["a"]);
    } finally {
        mock.timers.reset();
    }
});
