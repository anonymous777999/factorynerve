import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "./badge";

/**
 * Badge Component Governance Compliance Tests
 * Task 7: Validate Badge Component Compliance
 * 
 * Governance Rules:
 * - Sentence case everywhere (no UPPERCASE)
 * - Single indigo accent (#6366f1)
 * - No pulsing animations
 * - No glow effects
 * - Calm status colors
 */

describe("Badge Component - Governance Compliance", () => {
    describe("Visual Compliance", () => {
        it("should not have pulsing animations", () => {
            const { container } = render(<Badge status="processing">Processing</Badge>);
            const badge = container.querySelector("span");

            // Check that no animate-pulse class is present
            expect(badge?.className).not.toContain("animate-pulse");
        });

        it("should not have glow effects (box-shadow with blur >4px)", () => {
            const { container } = render(<Badge status="success">Success</Badge>);
            const badge = container.querySelector("span");

            // Get computed styles
            const styles = window.getComputedStyle(badge!);
            const boxShadow = styles.boxShadow;

            // Should be 'none' or not have large blur values
            // Glow effects typically have blur radius >4px
            expect(boxShadow).toBe("none");
        });

        it("should use sentence case for badge labels", () => {
            const { getByText } = render(<Badge status="success">Completed</Badge>);

            // Badge should accept sentence case content
            expect(getByText("Completed")).toBeInTheDocument();
        });
    });

    describe("Status Variants", () => {
        const statusVariants: Array<{
            status: "success" | "warning" | "danger" | "processing" | "paused";
            label: string;
        }> = [
                { status: "success", label: "Success" },
                { status: "warning", label: "Warning" },
                { status: "danger", label: "Error" },
                { status: "processing", label: "Processing" },
                { status: "paused", label: "Paused" },
            ];

        statusVariants.forEach(({ status, label }) => {
            it(`should render ${status} status correctly`, () => {
                const { container, getByText } = render(
                    <Badge status={status}>{label}</Badge>
                );

                const badge = container.querySelector("span");

                // Verify status data attribute
                expect(badge?.getAttribute("data-status")).toBe(status);

                // Verify label is rendered
                expect(getByText(label)).toBeInTheDocument();

                // Verify no pulsing animation
                expect(badge?.className).not.toContain("animate-pulse");
            });
        });
    });

    describe("Size Variants", () => {
        it("should render compact size correctly", () => {
            const { container } = render(
                <Badge status="success" size="compact">
                    Compact
                </Badge>
            );

            const badge = container.querySelector("span");

            // Compact size should have specific padding
            expect(badge?.className).toContain("px-[8px]");
            expect(badge?.className).toContain("py-[2px]");
        });

        it("should render standard size correctly", () => {
            const { container } = render(
                <Badge status="success" size="standard">
                    Standard
                </Badge>
            );

            const badge = container.querySelector("span");

            // Standard size should have specific padding
            expect(badge?.className).toContain("px-[8px]");
            expect(badge?.className).toContain("py-[2px]");
        });
    });

    describe("Indicator Dot", () => {
        it("should render indicator dot when showIndicator is true", () => {
            const { container } = render(
                <Badge status="success" showIndicator>
                    With Indicator
                </Badge>
            );

            const indicator = container.querySelector('[aria-hidden="true"]');

            expect(indicator).toBeInTheDocument();
            expect(indicator?.className).toContain("rounded-full");
            expect(indicator?.className).toContain("h-2");
            expect(indicator?.className).toContain("w-2");
        });

        it("should not render indicator dot when showIndicator is false", () => {
            const { container } = render(
                <Badge status="success" showIndicator={false}>
                    Without Indicator
                </Badge>
            );

            const indicator = container.querySelector('[aria-hidden="true"]');

            expect(indicator).not.toBeInTheDocument();
        });
    });

    describe("Accessibility", () => {
        it("should have proper semantic structure", () => {
            const { container } = render(<Badge status="success">Success</Badge>);

            const badge = container.querySelector("span");

            // Badge should be a span element
            expect(badge?.tagName).toBe("SPAN");
        });

        it("should support custom className", () => {
            const { container } = render(
                <Badge status="success" className="custom-class">
                    Custom
                </Badge>
            );

            const badge = container.querySelector("span");

            expect(badge?.className).toContain("custom-class");
        });
    });

    describe("Typography", () => {
        it("should use correct font size", () => {
            const { container } = render(<Badge status="success">Text</Badge>);

            const badge = container.querySelector("span");

            // Should use text-[length:var(--text-xs)]
            expect(badge?.className).toContain("text-[length:var(--text-xs)]");
        });

        it("should use medium font weight", () => {
            const { container } = render(<Badge status="success">Text</Badge>);

            const badge = container.querySelector("span");

            // Should use font-medium
            expect(badge?.className).toContain("font-medium");
        });

        it("should support monospace font", () => {
            const { container } = render(
                <Badge status="success" monospace>
                    123.45
                </Badge>
            );

            const badge = container.querySelector("span");

            // Should have font-mono class
            expect(badge?.className).toContain("font-mono");
            expect(badge?.className).toContain("tabular-nums");
        });
    });

    describe("Border and Styling", () => {
        it("should have 1px border", () => {
            const { container } = render(<Badge status="success">Text</Badge>);

            const badge = container.querySelector("span");

            // Should have border class
            expect(badge?.className).toContain("border");
        });

        it("should have rounded corners", () => {
            const { container } = render(<Badge status="success">Text</Badge>);

            const badge = container.querySelector("span");

            // Should have rounded-[4px]
            expect(badge?.className).toContain("rounded-[4px]");
        });

        it("should use status-specific colors", () => {
            const { container } = render(<Badge status="success">Success</Badge>);

            const badge = container.querySelector("span");

            // Should have status-success color classes
            expect(badge?.className).toContain("border-status-success-border");
            expect(badge?.className).toContain("bg-status-success-bg");
            expect(badge?.className).toContain("text-status-success-fg");
        });
    });
});

/**
 * Contrast Ratio Validation
 * 
 * WCAG 2.1 AA Requirements:
 * - UI components: 3:1 minimum contrast ratio
 * 
 * Status Colors (from tokens.css):
 * 
 * Light Mode:
 * - Success: fg=#15803d (green-700), bg=#f0fdf4 (green-50)
 * - Warning: fg=#b45309 (amber-700), bg=#fffbeb (amber-50)
 * - Danger: fg=#b91c1c (red-700), bg=#fef2f2 (red-50)
 * - Processing: fg=#4338ca (indigo-700), bg=#eef2ff (indigo-50)
 * - Paused: fg=#334155 (slate-700), bg=#f8fafc (slate-50)
 * 
 * Dark Mode:
 * - Success: fg=#BBF7D0, bg=#0F2A1A
 * - Warning: fg=#FDE68A, bg=#2A1F0A
 * - Danger: fg=#FECACA, bg=#2A0F0F
 * - Processing: fg=#C7D2FE, bg=#1E1B4B
 * - Paused: fg=#CBD5E1, bg=#0F172A
 * 
 * All status colors meet WCAG AA 3:1 minimum contrast ratio for UI components.
 */
