import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ActionDock } from "@/components/ui/action-dock";

const meta = {
  title: "Operational/ActionDock",
  component: ActionDock,
  tags: ["autodocs"],
  args: {
    variant: "drawer",
    title: "2 records selected",
    description: "Apply an approval decision without losing queue continuity.",
    tone: "processing",
    statusLabel: "Approval active",
    selectedCount: 2,
    primaryAction: { id: "approve", label: "Approve" },
    secondaryAction: { id: "reject", label: "Reject", variant: "outline" },
    tertiaryAction: { id: "save", label: "Save note", variant: "ghost" },
  },
} satisfies Meta<typeof ActionDock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Approval: Story = {};

export const Reconciliation: Story = {
  args: {
    tone: "warning",
    statusLabel: "Variance open",
    title: "4 batches selected",
    description: "Close matched variances or place disputed lots on hold.",
    selectedCount: 4,
    primaryAction: { id: "close", label: "Close variance" },
    secondaryAction: { id: "hold", label: "Hold batch", variant: "outline" },
    tertiaryAction: { id: "export", label: "Export note", variant: "ghost" },
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { value: "mobile1" },
  },
};

export const Loading: Story = {
  args: {
    tone: "processing",
    statusLabel: "Syncing",
    description: "Decision controls will unlock when current selection finishes refreshing.",
    primaryAction: { id: "approve", label: "Approve", isBusy: true },
  },
};

export const Empty: Story = {
  args: {
    tone: "default",
    statusLabel: "No selection",
    title: "Select a queue item",
    description: "Bulk actions stay hidden until at least one actionable record is selected.",
    selectedCount: 0,
    primaryAction: undefined,
    secondaryAction: undefined,
    tertiaryAction: undefined,
  },
};

export const Error: Story = {
  args: {
    tone: "error",
    statusLabel: "Sync blocked",
    description: "Selection is stale because the latest approval state could not be confirmed.",
  },
};
