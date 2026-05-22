import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "@/components/ui/badge";
import { Field, HelperText, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { WorkflowPanel } from "@/components/ui/workflow-panel";

const meta = {
  title: "UI/WorkflowPanel",
  component: WorkflowPanel,
  tags: ["autodocs"],
  args: {
    title: "OCR verification workspace",
    description:
      "Review extracted material details, keep step continuity visible, and finish the operational decision without losing queue context.",
    status: "processing",
    statusLabel: "Review active",
    stepLabel: "OCR workflow",
    steps: [
      {
        id: "capture",
        label: "Capture",
        description: "Document image and draft created",
        status: "complete",
      },
      {
        id: "review",
        label: "Review",
        description: "Verify extracted values before approval",
        status: "current",
      },
      {
        id: "decision",
        label: "Decision",
        description: "Approve, reject, or return to intake",
        status: "upcoming",
      },
    ],
    notes: [
      {
        id: "sync",
        label: "Draft synced",
        status: "synced",
        detail: "This verification draft is recoverable after refresh or route changes.",
      },
      {
        id: "focus",
        label: "Queue continuity",
        status: "processing",
        detail: "Stay in the current queue lane while reviewing this document.",
      },
    ],
    primaryAction: {
      id: "approve",
      label: "Approve",
      shortcutHint: "Cmd+Enter",
    },
    secondaryAction: {
      id: "reject",
      label: "Reject",
      shortcutHint: "Esc",
      variant: "outline",
    },
    tertiaryAction: {
      id: "save",
      label: "Save draft",
      shortcutHint: "Cmd+S",
      variant: "ghost",
    },
    sidebar: (
      <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-md">
        <div className="flex items-center gap-sm">
          <Badge status="warning">Operator note</Badge>
        </div>
        <p className="mt-sm text-body text-text-secondary">
          Source handwriting is faint in the supplier field. Cross-check against weighbridge slip before approval.
        </p>
      </div>
    ),
    footer: (
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <span className="text-label-dense text-text-secondary">
          Last sync confirmed 2 minutes ago.
        </span>
        <span className="text-label-dense text-text-secondary">
          Review lane: OCR intake queue
        </span>
      </div>
    ),
    children: (
      <div className="grid gap-md lg:grid-cols-2">
        <Field>
          <Label htmlFor="material-code">Material code</Label>
          <Input id="material-code" defaultValue="MTL-4421" readOnly />
          <HelperText>Use the source slip as the final truth if the OCR value looks stale.</HelperText>
        </Field>
        <Field>
          <Label htmlFor="supplier-name">Supplier</Label>
          <Input id="supplier-name" defaultValue="Shree Steel Traders" readOnly />
          <HelperText>Supplier name is editable in the downstream review step if needed.</HelperText>
        </Field>
      </div>
    ),
  },
} satisfies Meta<typeof WorkflowPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OcrReviewWorkspace: Story = {};

export const MultiStepOperationalReview: Story = {
  args: {
    title: "Attendance review decision panel",
    description:
      "Resolve the current issue, keep queue placement visible, and preserve the next decision path for the operator.",
    status: "paused",
    statusLabel: "Awaiting decision",
    stepLabel: "Review flow",
    steps: [
      {
        id: "queue",
        label: "Pick issue",
        description: "Review the next unresolved attendance signal",
        status: "complete",
      },
      {
        id: "detail",
        label: "Inspect detail",
        description: "Check punch history, notes, and suggested fix",
        status: "current",
      },
      {
        id: "close",
        label: "Close review",
        description: "Approve or reject without losing place in queue",
        status: "upcoming",
      },
    ],
    notes: [
      {
        id: "continuity",
        label: "Queue retained",
        status: "synced",
        detail: "Returning to the list will preserve the active issue in the URL and workflow cache.",
      },
      {
        id: "review",
        label: "Decision pending",
        status: "paused",
        detail: "A reviewer note is still required before final closure.",
      },
    ],
  },
};
