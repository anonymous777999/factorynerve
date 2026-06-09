import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { SmartInsightsPanel } from "@/components/dashboard/smart-insights-panel";
import type { SmartInsight } from "@/lib/industrial-dashboard";

/**
 * Sprint 2 Task 23 — Smart Insights with Confidence Indicators
 *
 * Story-driven coverage that the panel surfaces:
 *  - Color-coded confidence badges (high / medium / low)
 *  - Reasoning text truncated to 280 characters
 *  - Sentence case labels everywhere
 */
const baseInsights: SmartInsight[] = [
    {
        id: "loss",
        headline: "Steel loss increased by 9.4% in the latest window",
        supportingText:
            "Yield loss closed at 460 KG. The rolling and melt teams should review the last abnormal spike before the next batch closes.",
        tone: "warning",
        severity: "critical",
        impactScore: 469,
        nextStep: "Open the risk lane and trace the latest loss spike before the next batch closes.",
        primaryAction: { href: "/steel?tab=risk", label: "Open risk lane" },
        confidence: "high",
        reasoning:
            "Loss moved from 420 KG to 460 KG across the last two windows, a 9.4% shift driving this prompt.",
    },
    {
        id: "stock",
        headline: "Low steel stock watch: Finished goods",
        supportingText:
            "2,400 KG is the lowest live steel buffer. Raw material now stands at 6,200 KG.",
        tone: "warning",
        severity: "watch",
        impactScore: 7600,
        nextStep:
            "Check inventory confidence and replenish or recount the lowest buffer before production is squeezed.",
        primaryAction: { href: "/steel?tab=inventory", label: "Open inventory lane" },
        confidence: "medium",
        reasoning:
            "Finished goods buffer is 2,400 KG, which is the lowest live category in the inventory snapshot.",
    },
    {
        id: "revenue",
        headline: "Steel revenue increased by 2.1% over the previous period",
        supportingText:
            "Current invoiced steel value stands at INR 19,20,000. Dispatch discipline is directly supporting this movement.",
        tone: "good",
        severity: "good",
        impactScore: 1922,
        nextStep:
            "Keep invoices and dispatch closure aligned to preserve the current commercial pace.",
        primaryAction: { href: "/steel/invoices", label: "Open invoices" },
        confidence: "low",
        reasoning:
            "Latest invoiced value is INR 19,20,000 versus INR 18,80,000 previously, a 2.1% movement.",
    },
    {
        id: "batch",
        headline: "Top steel loss batch: B-1024",
        supportingText:
            "210 KG loss makes it the highest review priority in the current steel window.",
        tone: "warning",
        severity: "critical",
        impactScore: 210,
        nextStep:
            "Open the production or risk lane and trace the batch before approving the next shift pattern.",
        primaryAction: { href: "/steel?tab=production", label: "Open production lane" },
        confidence: "high",
        reasoning: "Batch B-1024 reported 210 KG loss, the highest in the current window.",
    },
];

const meta = {
    title: "Dashboard/SmartInsightsPanel",
    component: SmartInsightsPanel,
    parameters: { layout: "padded" },
    args: {
        insights: baseInsights,
        loading: false,
    },
} satisfies Meta<typeof SmartInsightsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithConfidence: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        // Confidence labels render in sentence case.
        const highBadges = canvas.getAllByText("High confidence");
        await expect(highBadges.length).toBeGreaterThan(0);
        await expect(canvas.getByText("Medium confidence")).toBeInTheDocument();
        await expect(canvas.getByText("Low confidence")).toBeInTheDocument();

        // Color tokens are wired through Tailwind utilities.
        const high = highBadges[0].closest("span[data-confidence]");
        await expect(high?.className).toContain("text-confidence-high-fg");

        const medium = canvas.getByText("Medium confidence").closest("span[data-confidence]");
        await expect(medium?.className).toContain("text-confidence-medium-fg");

        const low = canvas.getByText("Low confidence").closest("span[data-confidence]");
        await expect(low?.className).toContain("text-confidence-low-fg");
    },
};

export const ReasoningTruncation: Story = {
    args: {
        insights: [
            {
                ...baseInsights[0],
                reasoning: "X".repeat(400),
            },
        ],
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const badge = canvas.getByText("High confidence");
        const card = badge.closest("div.flex.flex-col");
        await expect(card).not.toBeNull();

        const paragraphs = card!.querySelectorAll("p");
        const reasoningParagraph = Array.from(paragraphs).find((p) =>
            p.textContent?.includes("X"),
        );
        await expect(reasoningParagraph).not.toBeUndefined();
        // Truncated to 280 chars including ellipsis.
        await expect(reasoningParagraph!.textContent!.length).toBe(280);
        await expect(reasoningParagraph!.textContent!.endsWith("…")).toBe(true);
    },
};

export const WithoutConfidence: Story = {
    args: {
        insights: baseInsights.map((insight) => {
            const next = { ...insight };
            delete next.confidence;
            delete next.reasoning;
            return next;
        }),
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Headline still renders.
        await expect(
            canvas.getByText("Steel loss increased by 9.4% in the latest window"),
        ).toBeInTheDocument();
        // No confidence badges should appear.
        await expect(canvas.queryByText("High confidence")).toBeNull();
        await expect(canvas.queryByText("Medium confidence")).toBeNull();
        await expect(canvas.queryByText("Low confidence")).toBeNull();
    },
};

export const Loading: Story = {
    args: { loading: true, insights: [] },
};
