import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";
import { EmptyOperationalState } from "@/components/ui/empty-operational-state";

const meta = {
  title: "Operational/EmptyOperationalState",
  component: EmptyOperationalState,
  tags: ["autodocs"],
  args: {
    eyebrow: "Approval lane",
    title: "No records waiting",
    description: "Filters are active, but no queued approvals currently match this workstation.",
    tone: "default",
    toneLabel: "Queue clear",
  },
} satisfies Meta<typeof EmptyOperationalState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <EmptyOperationalState
      {...args}
      action={<Button size="compact">Refresh queue</Button>}
      secondaryAction={
        <Button size="compact" variant="outline">
          Clear filters
        </Button>
      }
    />
  ),
};

export const Loading: Story = {
  args: {
    title: "Waiting for queue state",
    description: "The current workstation is reconnecting to workflow services.",
    tone: "processing",
    toneLabel: "Refreshing",
  },
};

export const Empty: Story = {};

export const Error: Story = {
  args: {
    title: "Queue state unavailable",
    description: "Approval data could not be loaded. Retry when backend routing is stable.",
    tone: "error",
    toneLabel: "Load failed",
  },
  render: (args) => (
    <EmptyOperationalState
      {...args}
      action={
        <Button size="compact" variant="outline">
          Retry queue
        </Button>
      }
    />
  ),
};
