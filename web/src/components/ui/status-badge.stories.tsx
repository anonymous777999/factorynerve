import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StatusBadge } from "@/components/ui/status-badge";

const meta = {
  title: "Operational/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  args: {
    children: "Approval required",
    tone: "approval",
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Approval: Story = {};

export const Reconciliation: Story = {
  render: () => (
    <div className="flex flex-wrap gap-sm">
      <StatusBadge tone="processing">In review</StatusBadge>
      <StatusBadge tone="warning">Variance flagged</StatusBadge>
      <StatusBadge tone="error">Sync failed</StatusBadge>
      <StatusBadge tone="synced">Closed</StatusBadge>
    </div>
  ),
};

export const Loading: Story = {
  args: {
    children: "Refreshing",
    tone: "processing",
  },
};

export const Empty: Story = {
  args: {
    children: "No assignment",
    tone: "default",
  },
};

export const Error: Story = {
  args: {
    children: "Escalation blocked",
    tone: "error",
  },
};
