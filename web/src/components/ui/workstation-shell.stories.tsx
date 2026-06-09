import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmptyOperationalState } from "@/components/ui/empty-operational-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { SectionPanel } from "@/components/ui/section-panel";
import { WorkstationShell } from "@/components/ui/workstation-shell";
import { activeFilters, approvalActions, filterFields, workstationMetrics } from "@/stories/operational-fixtures";

const shellContent = (
  <>
    <SectionPanel
      eyebrow="Queue"
      title="Active approval queue"
      description="Priority review items remain visible alongside the current decision workspace."
      tone="approval"
      toneLabel="41 pending"
    >
      <div className="space-y-sm">
        <div className="rounded-control border border-border-subtle bg-surface-shell px-md py-sm text-body text-text-primary">
          OCR verification 2418 is waiting on a manager check.
        </div>
        <div className="rounded-control border border-border-subtle bg-surface-shell px-md py-sm text-body text-text-primary">
          Weighment variance 1.25 t short has crossed the 8h SLA.
        </div>
      </div>
    </SectionPanel>
    <SectionPanel
      eyebrow="Workspace"
      title="Current decision detail"
      description="Use the queue selection to keep routing and approvals continuous across refresh."
      tone="processing"
      toneLabel="Review active"
    >
      <div className="grid gap-sm md:grid-cols-2">
        <div className="rounded-control border border-border-subtle bg-surface-shell px-md py-sm">Batch: B-2405-17</div>
        <div className="rounded-control border border-border-subtle bg-surface-shell px-md py-sm">Station: Hazira melt shop</div>
      </div>
    </SectionPanel>
  </>
);

const meta = {
  title: "Operational/WorkstationShell",
  component: WorkstationShell,
  tags: ["autodocs"],
  args: {
    eyebrow: "Operations control",
    title: "Approval workstation",
    description: "Dense, execution-focused workspace for OCR, approvals, and reconciliation lanes.",
    tone: "approval",
    toneLabel: "Supervisor lane",
    actions: approvalActions,
    metrics: workstationMetrics.map((item) => ({ ...item, badgeLabel: item.detail })),
    filters: (
      <FilterBar
        title="Queue filters"
        resultCount="128 total records"
        fields={filterFields}
        activeFilters={activeFilters}
        onClearAll={() => undefined}
      />
    ),
    rail: (
      <SectionPanel
        eyebrow="Signals"
        title="Route health"
        description="Operational signals that affect review continuity."
        tone="warning"
        toneLabel="2 active"
      >
        <div className="space-y-sm text-body text-text-secondary">
          <p>One mobile route returned without restoring the current approval drawer.</p>
          <p>One OCR session is still storing oversized image state in session memory.</p>
        </div>
      </SectionPanel>
    ),
    children: shellContent,
  },
} satisfies Meta<typeof WorkstationShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: { value: "mobile1" },
  },
};

export const Loading: Story = {
  render: (args) => (
    <LoadingBoundary isLoading hasData={false}>
      <WorkstationShell {...args} />
    </LoadingBoundary>
  ),
};

export const Empty: Story = {
  args: {
    children: (
      <EmptyOperationalState
        eyebrow="Approval lane"
        title="No active workstations assigned"
        description="This role currently has no routed items from OCR, approvals, or reconciliation queues."
        tone="default"
        toneLabel="Unassigned"
      />
    ),
  },
};

export const ErrorState: Story = {
  render: (args) => (
    <LoadingBoundary
      isError
      hasData={false}
      error={new Error("Workstation shell failed to load queue configuration.")}
      onRetry={() => undefined}
    >
      <WorkstationShell {...args} />
    </LoadingBoundary>
  ),
};
