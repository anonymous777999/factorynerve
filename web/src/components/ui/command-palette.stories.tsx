"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";

import {
  CommandPalette,
  type CommandPaletteItem,
} from "@/components/ui/command-palette";

const baseItems: CommandPaletteItem[] = [
  {
    id: "new-receipt",
    group: "Receiving",
    label: "Create inbound receipt",
    description: "Start a new receipt without leaving the active receiving queue.",
    shortcut: "N",
    status: "draft",
    meta: "Receiving hub",
  },
  {
    id: "resume-ocr-review",
    group: "OCR Workflows",
    label: "Resume OCR verification",
    description: "Return to the current OCR review lane and keep the queue position intact.",
    shortcut: "Cmd+Enter",
    status: "processing",
    meta: "Review lane A",
  },
  {
    id: "retry-sync",
    group: "Recovery",
    label: "Retry failed sync",
    description: "Retry the last failed workflow mutation when the connection is stable.",
    shortcut: "R",
    status: "error",
    meta: "2 pending",
  },
  {
    id: "open-jobs",
    group: "Operations",
    label: "Open background jobs",
    description: "Track exports, AI work, and retries from any route.",
    shortcut: "J",
    status: "paused",
    meta: "1 active",
  },
  {
    id: "void-batch",
    group: "High Risk",
    label: "Void selected batch",
    description: "Requires confirmation before applying an irreversible ledger change.",
    shortcut: "Shift+V",
    danger: true,
    status: "warning",
    meta: "Confirmation required",
  },
];

function PaletteStoryFrame({
  items = baseItems,
  open = true,
}: {
  items?: CommandPaletteItem[];
  open?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(open);

  return (
    <div className="min-h-screen bg-surface-shell p-lg">
      <div className="rounded-panel border border-border-subtle bg-surface-panel px-md py-md">
        <p className="text-label font-semibold text-text-primary">Operational command surface</p>
        <p className="mt-xs text-label-dense text-text-secondary">
          Use the palette to jump to the next workflow action without leaving keyboard context.
        </p>
      </div>
      <CommandPalette
        open={isOpen}
        onOpenChange={setIsOpen}
        items={items}
        enableGlobalShortcut
      />
    </div>
  );
}

const meta = {
  title: "UI/CommandPalette",
  component: CommandPalette,
  tags: ["autodocs"],
  parameters: {
    controls: {
      exclude: ["items", "footer", "onOpenChange"],
    },
  },
} satisfies Meta<typeof CommandPalette>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OperationalRouting: Story = {
  render: () => <PaletteStoryFrame />,
};

export const ReviewAndRecovery: Story = {
  render: () => (
    <PaletteStoryFrame
      items={[
        {
          id: "resume-draft",
          group: "Review Recovery",
          label: "Resume recovered draft",
          description: "Continue the previous operator session from the saved review state.",
          shortcut: "Enter",
          status: "draft",
          meta: "Saved 2m ago",
        },
        {
          id: "reconnect-queue",
          group: "Review Recovery",
          label: "Reconnect queue sync",
          description: "Restore background synchronization without reloading the review screen.",
          shortcut: "R",
          status: "processing",
          meta: "Silent resync",
        },
        {
          id: "approve-current",
          group: "Current Step",
          label: "Approve current review",
          description: "Confirm the reviewed values and return focus to the queue.",
          shortcut: "Cmd+Enter",
          status: "synced",
          meta: "Ready",
        },
      ]}
    />
  ),
};

export const EmptySearchState: Story = {
  render: () => (
    <PaletteStoryFrame items={[]} />
  ),
};
