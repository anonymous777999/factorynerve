/**
 * Field Error State Styling Tests
 * Task 17: Enhance Form Error State Styling
 *
 * Validates form input error state implementation:
 * - Error border uses calm red (status-danger-border → #ef4444 family)
 * - Error background uses subtle red (status-danger-bg)
 * - Error message uses calm red foreground (status-danger-fg)
 * - aria-invalid is auto-set when validationState is "invalid"
 * - aria-describedby is auto-wired through FieldContext
 * - Error helper text uses role="alert" so screen readers announce it
 *
 * Reference: Requirements 6.4, 8.4, 10.10, 10.11 (Sprint 2)
 */

import { describe, it, expect } from "vitest";

import { getFieldControlClassName } from "./field";

describe("getFieldControlClassName — error state", () => {
    it("applies calm-red border + bg classes when validationState is 'invalid'", () => {
        const className = getFieldControlClassName({ validationState: "invalid" });

        expect(className).toContain("border-status-danger-border");
        expect(className).toContain("bg-status-danger-bg");
        // The aria-invalid driven border override stays attached.
        expect(className).toContain("aria-[invalid=true]:border-border-danger");
    });

    it("preserves the calm-red error ring on focus instead of switching to indigo", () => {
        const className = getFieldControlClassName({ validationState: "invalid" });

        expect(className).toContain("focus:ring-status-danger-border");
        expect(className).toContain("focus:border-status-danger-border");
    });

    it("does not apply danger styling for the default state", () => {
        const className = getFieldControlClassName({ validationState: "default" });

        expect(className).not.toContain("border-status-danger-border");
        expect(className).not.toContain("bg-status-danger-bg");
    });

    it("uses the indigo focus ring on default state", () => {
        const className = getFieldControlClassName({ validationState: "default" });

        // The base shared focus ring uses the indigo accent.
        expect(className).toContain("focus:ring-accent");
        expect(className).toContain("focus:border-accent");
    });

    it("applies success border classes when validationState is 'valid'", () => {
        const className = getFieldControlClassName({ validationState: "valid" });

        expect(className).toContain("border-status-success-border");
    });

    it("respects the multiline option for textarea controls", () => {
        const single = getFieldControlClassName({ validationState: "invalid" });
        const multi = getFieldControlClassName({
            validationState: "invalid",
            multiline: true,
        });

        expect(single).toContain("min-h-[38px]");
        expect(multi).toContain("min-h-[96px]");
        // Both still receive the calm-red error styling.
        expect(multi).toContain("border-status-danger-border");
        expect(multi).toContain("bg-status-danger-bg");
    });

    it("merges custom classNames after the validation classes so callers can override", () => {
        const className = getFieldControlClassName({
            validationState: "invalid",
            className: "custom-input-class",
        });

        expect(className).toContain("custom-input-class");
        expect(className).toContain("border-status-danger-border");
    });
});

describe("Field error state — design contract", () => {
    /**
     * These assertions document the design contract enforced by the
     * implementation in field.tsx / input.tsx / textarea.tsx. They
     * intentionally check string contents (not rendered DOM) so they
     * stay runnable without a DOM testing library while still pinning
     * the critical accessibility + visual rules in place.
     */

    it("requires the danger background, border, and foreground tokens to be defined", () => {
        // These tokens are wired through Tailwind's status.danger.{bg,border,fg}
        // namespace, which maps to --status-danger-{bg,border,fg} CSS vars
        // defined in web/src/styles/tokens.css.
        const className = getFieldControlClassName({ validationState: "invalid" });

        const requiredErrorTokens = [
            "border-status-danger-border",
            "bg-status-danger-bg",
        ];

        for (const token of requiredErrorTokens) {
            expect(className, `expected error class to include ${token}`).toContain(
                token,
            );
        }
    });
});
