import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MetricStrip } from "@/components/ui/metric-strip";
import { workstationMetrics } from "@/stories/operational-fixtures";

const meta = {
  title: "Operational/MetricStrip",
  component: MetricStrip,
  tags: ["autodocs"],
  args: {
    items: workstationMetrics.map((item) => ({ ...item, badgeLabel: item.detail })),
  },
} satisfies Meta<typeof MetricStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DenseOperations: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: {
      value: "mobile1",
    },
  },
};

export const Loading: Story = {
  args: {
    items: workstationMetrics.map((item) => ({
      id: item.id,
      label: item.label,
      value: "--",
      detail: "Fetching latest totals",
      tone: "processing",
      badgeLabel: "Loading",
    })),
  },
};

export const Empty: Story = {
  args: {
    items: [
      { id: "none", label: "Open queue", value: "0", detail: "No active work", tone: "success", badgeLabel: "Clear" },
      { id: "audit", label: "Audit holds", value: "0", detail: "No pending holds", tone: "success", badgeLabel: "Clear" },
    ],
  },
};

export const Error: Story = {
  args: {
    items: workstationMetrics.map((item) => ({
      id: item.id,
      label: item.label,
      value: "!",
      detail: "Sync unavailable",
      tone: "error",
      badgeLabel: "Error",
    })),
  },
};
