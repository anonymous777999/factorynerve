import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "@/components/ui/badge";

const meta = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "Processing",
    status: "processing",
    showIndicator: true,
  },
  argTypes: {
    status: {
      control: "inline-radio",
      options: ["success", "warning", "processing", "paused", "draft", "synced", "error"],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OperationalSet: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-sm">
      <Badge status="success">Verified</Badge>
      <Badge status="warning">Attention</Badge>
      <Badge status="processing">Processing</Badge>
      <Badge status="paused">Paused</Badge>
      <Badge status="draft">Draft</Badge>
      <Badge status="synced">Synced</Badge>
      <Badge status="error">Failed</Badge>
    </div>
  ),
};
