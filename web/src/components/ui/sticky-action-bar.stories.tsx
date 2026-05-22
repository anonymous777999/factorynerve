import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Field, HelperText, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";

function FormPreview() {
  return (
    <div className="space-y-md">
      <div className="grid gap-md lg:grid-cols-2">
        <Field>
          <Label htmlFor="receipt-id">Receipt ID</Label>
          <Input id="receipt-id" defaultValue="RCV-2841" />
          <HelperText>Keep the operational reference visible for downstream approval.</HelperText>
        </Field>
        <Field>
          <Label htmlFor="supplier">Supplier</Label>
          <Input id="supplier" defaultValue="Shree Steel Traders" />
          <HelperText>Use the dispatch slip name when the invoice label is inconsistent.</HelperText>
        </Field>
      </div>
      <div className="grid gap-md lg:grid-cols-2">
        <Field>
          <Label htmlFor="vehicle">Vehicle</Label>
          <Input id="vehicle" defaultValue="MH12-4203" />
          <HelperText>Vehicle identity should match the current queue item before submission.</HelperText>
        </Field>
        <Field>
          <Label htmlFor="weight">Net weight</Label>
          <Input id="weight" defaultValue="1,980 kg" />
          <HelperText>Numeric values remain editable until the approval step closes.</HelperText>
        </Field>
      </div>
      <div className="h-table-lg rounded-panel border border-border-subtle bg-surface-shell" />
    </div>
  );
}

const meta = {
  title: "UI/StickyActionBar",
  component: StickyActionBar,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="space-y-md">
        <FormPreview />
        <Story />
      </div>
    ),
  ],
  args: {
    title: "Receipt review in progress",
    description:
      "Primary approval actions stay visible while operators review large operational forms.",
    status: "processing",
    statusLabel: "Unsaved changes",
    meta: "Last draft sync 2 minutes ago. Queue position is preserved on refresh.",
    primaryAction: {
      id: "approve",
      label: "Approve",
      shortcutHint: "Cmd+Enter",
    },
    secondaryAction: {
      id: "save",
      label: "Save draft",
      shortcutHint: "Cmd+S",
      variant: "outline",
    },
    tertiaryAction: {
      id: "cancel",
      label: "Cancel",
      shortcutHint: "Esc",
      variant: "ghost",
    },
  },
} satisfies Meta<typeof StickyActionBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReviewFlow: Story = {};

export const ApprovalPaused: Story = {
  args: {
    title: "Approval blocked",
    description: "A reviewer note is required before final approval can continue.",
    status: "paused",
    statusLabel: "Awaiting note",
    primaryAction: {
      id: "resume",
      label: "Resume review",
      shortcutHint: "Enter",
      variant: "primary",
    },
    secondaryAction: {
      id: "save",
      label: "Save draft",
      shortcutHint: "Cmd+S",
      variant: "outline",
    },
  },
};
