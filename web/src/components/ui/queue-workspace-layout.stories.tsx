import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmptyOperationalState } from "@/components/ui/empty-operational-state";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { QueueWorkspaceLayout } from "@/components/ui/queue-workspace-layout";
import { SectionPanel } from "@/components/ui/section-panel";

const queuePanel = (
  <SectionPanel
    eyebrow="Queue"
    title="Prioritized review list"
    description="Top items sorted by age, workflow severity, and approval ownership."
    tone="warning"
    toneLabel="19 above SLA"
  >
    <div className="space-y-sm">
      <div className="rounded-control border border-border-subtle bg-surface-shell px-md py-sm">
        OCR 2418 - 56% confidence - 9h waiting
      </div>
      <div className="rounded-control border border-border-subtle bg-surface-shell px-md py-sm">
        Batch B-2405-17 - 1.25 t short - manager review
      </div>
      <div className="rounded-control border border-border-subtle bg-surface-shell px-md py-sm">
        Attendance correction - payroll cutoff today
      </div>
    </div>
  </SectionPanel>
);

const workspacePanel = (
  <SectionPanel
    eyebrow="Workspace"
    title="Selected review detail"
    description="Queue selection and action continuity remain stable across desktop and tablet layouts."
    tone="processing"
    toneLabel="OCR review active"
  >
    <div className="grid gap-sm md:grid-cols-2">
      <div className="rounded-control border border-border-subtle bg-surface-shell px-md py-sm">
        Document: Inbound weighment slip
      </div>
      <div className="rounded-control border border-border-subtle bg-surface-shell px-md py-sm">
        Owner: A. Patel
      </div>
    </div>
  </SectionPanel>
);

const meta = {
  title: "Operational/QueueWorkspaceLayout",
  component: QueueWorkspaceLayout,
  tags: ["autodocs"],
  args: {
    queueTitle: "Approval backlog",
    workspaceTitle: "Decision workspace",
    queue: queuePanel,
    workspace: workspacePanel,
  },
} satisfies Meta<typeof QueueWorkspaceLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: { value: "mobile1" },
  },
};

export const Loading: Story = {
  render: (args) => (
    <LoadingBoundary isLoading hasData={false} loadingTitle="Loading queue and workspace">
      <QueueWorkspaceLayout {...args} />
    </LoadingBoundary>
  ),
};

export const Empty: Story = {
  args: {
    queue: (
      <EmptyOperationalState
        eyebrow="Approval backlog"
        title="Queue is clear"
        description="No OCR, attendance, or reconciliation tasks are currently routed to this workstation."
        tone="success"
        toneLabel="No tasks"
      />
    ),
    workspace: (
      <EmptyOperationalState
        eyebrow="Decision workspace"
        title="Select the next task"
        description="The detail workspace becomes active once a queue record is selected."
        tone="default"
        toneLabel="Idle"
      />
    ),
  },
};

export const ErrorState: Story = {
  render: (args) => (
    <LoadingBoundary
      isError
      hasData={false}
      error={new Error("Queue/workspace split could not restore the last active selection.")}
      onRetry={() => undefined}
    >
      <QueueWorkspaceLayout {...args} />
    </LoadingBoundary>
  ),
};
