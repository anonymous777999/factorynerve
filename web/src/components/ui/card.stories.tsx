import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const meta = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
  render: () => (
    <Card className="max-w-3xl">
      <CardHeader className="flex items-start justify-between gap-md">
        <div className="space-y-xs">
          <CardTitle>Material Receipt Queue</CardTitle>
          <p className="text-body text-text-secondary">
            Operators can review inbound receipts, sync status, and validation exceptions in one surface.
          </p>
        </div>
        <Badge status="processing">Refreshing</Badge>
      </CardHeader>
      <CardContent className="space-y-sm">
        <div className="flex items-center justify-between gap-md rounded-control border border-border-subtle bg-surface-shell px-md py-sm">
          <span className="text-body text-text-primary">Pending verification</span>
          <span className="font-mono text-numeric-sm text-text-secondary">24</span>
        </div>
        <div className="flex items-center justify-between gap-md rounded-control border border-border-subtle bg-surface-shell px-md py-sm">
          <span className="text-body text-text-primary">Blocked syncs</span>
          <span className="font-mono text-numeric-sm text-status-danger-fg">2</span>
        </div>
      </CardContent>
    </Card>
  ),
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
