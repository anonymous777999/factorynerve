import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import {
    ConfidenceBadge,
    confidenceLevelFromScore,
    truncateReasoning,
} from "@/components/ui/confidence-badge";

/**
 * Sprint 2 Task 23 — Confidence Level Indicators
 *
 * Stories double as interaction tests under the storybook vitest project,
 * verifying:
 *  - Color-coded foreground tokens (green / amber / slate)
 *  - Sentence case default labels
 *  - No pulsing animations
 *  - Numeric score → level mapping
 *  - 280-character reasoning truncation
 */
const meta = {
    title: "UI/ConfidenceBadge",
    component: ConfidenceBadge,
    tags: ["autodocs"],
    args: {
        level: "high",
    },
    argTypes: {
        level: {
            control: "inline-radio",
            options: ["high", "medium", "low"],
        },
    },
} satisfies Meta<typeof ConfidenceBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const High: Story = {
    args: { level: "high" },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const badge = canvas.getByText("High confidence");
        await expect(badge).toBeInTheDocument();

        const wrapper = badge.closest("span[data-confidence]");
        await expect(wrapper).not.toBeNull();
        await expect(wrapper?.getAttribute("data-confidence")).toBe("high");
        // Green token wired via Tailwind utility (Sprint 2 Task 4 + Task 22).
        await expect(wrapper?.className).toContain("text-confidence-high-fg");
        // No pulsing animation - governance rule.
        await expect(wrapper?.className).not.toContain("animate-pulse");
    },
};

export const Medium: Story = {
    args: { level: "medium" },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const badge = canvas.getByText("Medium confidence");
        await expect(badge).toBeInTheDocument();

        const wrapper = badge.closest("span[data-confidence]");
        await expect(wrapper?.getAttribute("data-confidence")).toBe("medium");
        await expect(wrapper?.className).toContain("text-confidence-medium-fg");
    },
};

export const Low: Story = {
    args: { level: "low" },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const badge = canvas.getByText("Low confidence");
        await expect(badge).toBeInTheDocument();

        const wrapper = badge.closest("span[data-confidence]");
        await expect(wrapper?.getAttribute("data-confidence")).toBe("low");
        await expect(wrapper?.className).toContain("text-confidence-low-fg");
    },
};

export const WithReasoning: Story = {
    render: () => (
        <div className="flex max-w-sm flex-col gap-2">
            <ConfidenceBadge level="medium" label="Medium · 72%" />
            <p className="text-xs leading-5 text-text-tertiary">
                {truncateReasoning(
                    "Loss moved from 410 KG to 460 KG across the last two windows. " +
                    "Direction is consistent but the swing is smaller than the high-confidence " +
                    "threshold so manually validate the upstream rolling mill numbers before " +
                    "escalating to the production review queue.",
                )}
            </p>
        </div>
    ),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const badge = canvas.getByText("Medium · 72%");
        await expect(badge).toBeInTheDocument();
    },
};

export const FullSet: Story = {
    render: () => (
        <div className="flex flex-wrap items-center gap-2">
            <ConfidenceBadge level="high" />
            <ConfidenceBadge level="medium" />
            <ConfidenceBadge level="low" />
        </div>
    ),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByText("High confidence")).toBeInTheDocument();
        await expect(canvas.getByText("Medium confidence")).toBeInTheDocument();
        await expect(canvas.getByText("Low confidence")).toBeInTheDocument();
    },
};

/**
 * Helper validation - exercised inside a story play function so it runs under
 * the storybook vitest project without needing a separate test runner.
 */
export const HelperValidation: Story = {
    args: { level: "high" },
    play: async () => {
        // Score thresholds: >=85 high, >=60 medium, else low.
        await expect(confidenceLevelFromScore(95)).toBe("high");
        await expect(confidenceLevelFromScore(85)).toBe("high");
        await expect(confidenceLevelFromScore(75)).toBe("medium");
        await expect(confidenceLevelFromScore(60)).toBe("medium");
        await expect(confidenceLevelFromScore(40)).toBe("low");
        await expect(confidenceLevelFromScore(null)).toBe("low");
        await expect(confidenceLevelFromScore(undefined)).toBe("low");
        await expect(confidenceLevelFromScore(Number.NaN)).toBe("low");

        // Reasoning truncation enforces 280-character cap.
        await expect(truncateReasoning("short")).toBe("short");
        const long = "x".repeat(400);
        const truncated = truncateReasoning(long);
        await expect(truncated.length).toBe(280);
        await expect(truncated.endsWith("…")).toBe(true);
        await expect(truncateReasoning("")).toBe("");
    },
};
