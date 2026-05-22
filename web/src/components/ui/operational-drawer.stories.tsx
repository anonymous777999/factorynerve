"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, HelperText, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OperationalDrawer } from "@/components/ui/operational-drawer";
import { RecoveryBanner } from "@/components/ui/recovery-banner";

function DrawerStoryFrame({
  children,
  open = true,
}: {
  children: (args: { open: boolean; setOpen: React.Dispatch<React.SetStateAction<boolean>> }) => React.ReactNode;
  open?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(open);

  return (
    <div className="min-h-screen bg-surface-shell p-lg">
      <div className="flex items-center justify-between gap-sm rounded-panel border border-border-subtle bg-surface-panel px-md py-sm">
        <div>
          <p className="text-label font-semibold text-text-primary">Workflow context stays visible</p>
          <p className="text-label-dense text-text-secondary">
            Use the drawer for contextual actions without navigating away from the current operational lane.
          </p>
        </div>
        <Button size="compact" onClick={() => setIsOpen(true)}>
          Open drawer
        </Button>
      </div>
      {children({ open: isOpen, setOpen: setIsOpen })}
    </div>
  );
}

const meta = {
  title: "UI/OperationalDrawer",
  component: OperationalDrawer,
  tags: ["autodocs"],
  parameters: {
    controls: {
      exclude: [
        "children",
        "footer",
        "meta",
        "primaryAction",
        "secondaryAction",
        "tertiaryAction",
        "onOpenChange",
        "initialFocusRef",
      ],
    },
  },
  args: {
    title: "Review exception details",
    description:
      "Inspect the current exception, apply a contextual decision, and return to the queue without losing row focus.",
    status: "processing",
    statusLabel: "Review active",
    side: "right",
    size: "default",
  },
} satisfies Meta<typeof OperationalDrawer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReviewContext: Story = {
  render: (args) => (
    <DrawerStoryFrame>
      {({ open, setOpen }) => (
        <OperationalDrawer
          {...args}
          open={open}
          onOpenChange={setOpen}
          meta="Queue lane: OCR verification. Last sync confirmed 2 minutes ago."
          primaryAction={{ id: "approve", label: "Approve", shortcutHint: "Cmd+Enter" }}
          secondaryAction={{
            id: "return",
            label: "Return to intake",
            variant: "outline",
            shortcutHint: "Esc",
          }}
          tertiaryAction={{ id: "save", label: "Save draft", variant: "ghost", shortcutHint: "Cmd+S" }}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <span className="text-label-dense text-text-secondary">Operator: Receiving desk A</span>
              <span className="text-label-dense text-text-secondary">Record: OCR-20418</span>
            </div>
          }
        >
          <div className="space-y-md">
            <RecoveryBanner
              kind="unsaved-draft"
              title="Recovered draft values are available"
              description="Resume the saved review state if you want to keep the previous operator edits."
              statusLabel="Draft found"
              primaryAction={{ id: "resume", label: "Resume draft" }}
              secondaryAction={{ id: "fresh", label: "Start fresh", variant: "ghost" }}
            />
            <Field>
              <Label htmlFor="supplier">Supplier</Label>
              <Input id="supplier" defaultValue="Shree Steel Traders" />
              <HelperText>Use the source slip as the final truth if OCR confidence is low.</HelperText>
            </Field>
            <Field>
              <Label htmlFor="vehicle">Vehicle number</Label>
              <Input id="vehicle" defaultValue="MH12XZ2041" />
              <HelperText>Keep the queue moving by correcting only the risky fields.</HelperText>
            </Field>
          </div>
        </OperationalDrawer>
      )}
    </DrawerStoryFrame>
  ),
};

export const JobsStylePanel: Story = {
  render: (args) => (
    <DrawerStoryFrame>
      {({ open, setOpen }) => (
        <OperationalDrawer
          {...args}
          open={open}
          onOpenChange={setOpen}
          title="Background work continuity"
          description="Track jobs, check failures, and take the next action without leaving the current workflow."
          status="paused"
          statusLabel="Needs review"
          size="wide"
          meta="2 jobs need action. 1 export is still processing."
          primaryAction={{ id: "retry-failed", label: "Retry failed", shortcutHint: "R" }}
          secondaryAction={{ id: "dismiss", label: "Dismiss completed", variant: "outline" }}
        >
          <div className="space-y-sm">
            <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm">
              <div className="flex items-center justify-between gap-sm">
                <div className="space-y-xs">
                  <p className="text-label font-semibold text-text-primary">Range export failed</p>
                  <p className="text-label-dense text-text-secondary">
                    The export was not saved. Retry when the network is stable.
                  </p>
                </div>
                <Badge status="error">Failed</Badge>
              </div>
            </div>
            <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm">
              <div className="flex items-center justify-between gap-sm">
                <div className="space-y-xs">
                  <p className="text-label font-semibold text-text-primary">Executive summary running</p>
                  <p className="text-label-dense text-text-secondary">
                    AI processing is active. You can continue reviewing other work.
                  </p>
                </div>
                <Badge status="processing">Running</Badge>
              </div>
            </div>
          </div>
        </OperationalDrawer>
      )}
    </DrawerStoryFrame>
  ),
};

export const MobileBottomSheet: Story = {
  render: (args) => (
    <DrawerStoryFrame>
      {({ open, setOpen }) => (
        <OperationalDrawer
          {...args}
          open={open}
          onOpenChange={setOpen}
          title="Quick approval actions"
          description="Use the bottom drawer for fast contextual actions on smaller screens."
          status="synced"
          statusLabel="Ready"
          side="bottom"
          primaryAction={{ id: "approve-now", label: "Approve now", shortcutHint: "Enter" }}
          secondaryAction={{ id: "hold", label: "Place on hold", variant: "outline" }}
        >
          <div className="space-y-sm">
            <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm">
              <p className="text-label font-semibold text-text-primary">Attendance exception 04-218</p>
              <p className="text-label-dense text-text-secondary">
                Punch-in mismatch is resolved. Final approval can be completed from this drawer.
              </p>
            </div>
            <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm">
              <p className="text-label font-semibold text-text-primary">Next step</p>
              <p className="text-label-dense text-text-secondary">
                Approval writes to the workflow log and returns focus to the active queue row.
              </p>
            </div>
          </div>
        </OperationalDrawer>
      )}
    </DrawerStoryFrame>
  ),
};
