import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    title: "No receipts match this queue",
    description:
      "Adjust the current filters or create the next inbound receipt to keep the receiving workflow moving.",
    status: "draft",
    statusLabel: "No records",
  },
  render: (args) => (
    <EmptyState
      {...args}
      action={<Button size="compact">Create receipt</Button>}
      secondaryAction={
        <Button size="compact" variant="outline">
          Clear filters
        </Button>
      }
    />
  ),
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ErrorRecovery: Story = {
  args: {
    title: "The dispatch queue could not be loaded",
    description: "Review the sync issue and retry when the connection is stable.",
    status: "error",
    statusLabel: "Load failed",
  },
  render: (args) => (
    <EmptyState
      {...args}
      action={
        <Button size="compact" variant="outline">
          Retry queue
        </Button>
      }
    />
  ),
};
