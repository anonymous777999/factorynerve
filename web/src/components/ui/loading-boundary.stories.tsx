import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingBoundary } from "@/components/ui/loading-boundary";

function SampleOperationalPanel() {
  return (
    <Card className="max-w-4xl">
      <CardHeader className="flex items-start justify-between gap-md">
        <div className="space-y-xs">
          <CardTitle>Dispatch verification queue</CardTitle>
          <p className="text-body text-text-secondary">
            Current operator assignments and sync visibility remain available during background refresh.
          </p>
        </div>
        <Button size="compact" variant="outline">
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-sm">
        <div className="flex items-center justify-between gap-md rounded-control border border-border-subtle bg-surface-shell px-md py-sm">
          <span className="text-body text-text-primary">TRK-1042</span>
          <span className="font-mono text-numeric-sm text-text-secondary">Awaiting weighment</span>
        </div>
        <div className="flex items-center justify-between gap-md rounded-control border border-border-subtle bg-surface-shell px-md py-sm">
          <span className="text-body text-text-primary">TRK-1043</span>
          <span className="font-mono text-numeric-sm text-text-secondary">Awaiting QA release</span>
        </div>
      </CardContent>
    </Card>
  );
}

const meta = {
  title: "UI/LoadingBoundary",
  component: LoadingBoundary,
  tags: ["autodocs"],
  parameters: {
    controls: {
      exclude: ["children", "loadingFallback", "emptyFallback", "errorFallback", "onRetry"],
    },
  },
  args: {
    children: <SampleOperationalPanel />,
    hasData: true,
    isLoading: false,
    isFetching: false,
    isError: false,
    isEmpty: false,
    onRetry: () => undefined,
  },
} satisfies Meta<typeof LoadingBoundary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithData: Story = {};

export const Loading: Story = {
  args: {
    children: undefined,
    hasData: false,
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    children: undefined,
    hasData: false,
    isEmpty: true,
    emptyTitle: "No dispatches are waiting",
    emptyMessage: "This queue is clear. New work will appear here as receiving completes.",
  },
};

export const Failure: Story = {
  args: {
    children: undefined,
    hasData: false,
    isError: true,
    error: new Error("Network sync timed out while loading the dispatch queue."),
  },
};

export const BackgroundRefreshFailure: Story = {
  args: {
    isError: true,
    isFetching: true,
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      value: "mobile1",
    },
  },
};
