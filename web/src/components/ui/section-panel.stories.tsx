import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmptyOperationalState } from "@/components/ui/empty-operational-state";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { SectionPanel } from "@/components/ui/section-panel";
import { ActionRow, DenseReviewForm, approvalActions, approvalFacts } from "@/stories/operational-fixtures";

const meta = {
  title: "Operational/SectionPanel",
  component: SectionPanel,
  tags: ["autodocs"],
  args: {
    eyebrow: "Reconciliation",
    title: "Variance decision workspace",
    description: "Keep reviewer context visible while validating weighment and supplier variance before closure.",
    tone: "warning",
    toneLabel: "Variance open",
    actions: approvalActions,
    meta: (
      <div className="flex flex-wrap gap-sm">
        {approvalFacts.map((fact) => (
          <span key={fact.label} className="rounded-control border border-border-subtle px-sm py-xs text-label-dense">
            {fact.label}: <strong className="font-mono text-text-primary">{fact.value}</strong>
          </span>
        ))}
      </div>
    ),
    footer: <ActionRow />,
    children: <DenseReviewForm />,
  },
} satisfies Meta<typeof SectionPanel>;

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
    <LoadingBoundary isLoading hasData={false} loadingTitle={args.title}>
      <SectionPanel {...args} />
    </LoadingBoundary>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <SectionPanel {...args}>
      <EmptyOperationalState
        eyebrow="Variance lane"
        title="No variances to review"
        description="All current receipts have been matched to backend batch and weighbridge records."
        tone="success"
        toneLabel="Queue clear"
      />
    </SectionPanel>
  ),
};

export const ErrorState: Story = {
  render: (args) => (
    <LoadingBoundary
      isError
      hasData={false}
      error={new Error("Variance workspace could not refresh.")}
      onRetry={() => undefined}
    >
      <SectionPanel {...args} />
    </LoadingBoundary>
  ),
};
