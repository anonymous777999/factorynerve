import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { RecoveryBanner } from "@/components/ui/recovery-banner";

const meta = {
  title: "UI/RecoveryBanner",
  component: RecoveryBanner,
  tags: ["autodocs"],
  args: {
    kind: "sync-failure",
    title: "Queue sync was interrupted",
    description:
      "Your current review context is still available. Retry sync when the connection is stable to continue processing safely.",
    meta: "Last confirmed sync: 2 minutes ago. Active lane: OCR intake queue.",
    primaryAction: {
      id: "retry-sync",
      label: "Retry sync",
      shortcutHint: "R",
    },
    secondaryAction: {
      id: "stay-in-review",
      label: "Keep reviewing",
      variant: "outline",
    },
  },
  parameters: {
    controls: {
      exclude: ["primaryAction", "secondaryAction", "tertiaryAction", "meta"],
    },
  },
} satisfies Meta<typeof RecoveryBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SyncFailure: Story = {};

export const OfflineRecovery: Story = {
  args: {
    kind: "offline",
    title: "Connection lost. Review can continue in recovery mode.",
    description:
      "Recent records remain visible, but new server updates are paused until the connection returns.",
    meta: "Edits will remain pending until connectivity is restored.",
    statusLabel: "Offline recovery",
    primaryAction: {
      id: "retry-connection",
      label: "Retry connection",
      shortcutHint: "R",
    },
    secondaryAction: {
      id: "dismiss-offline",
      label: "Dismiss",
      variant: "ghost",
    },
  },
};

export const UnsavedDraft: Story = {
  args: {
    kind: "unsaved-draft",
    title: "Recovered review draft is ready",
    description:
      "A pending operator draft was found for this workflow. Resume from the saved values to avoid rework.",
    meta: "Draft captured before route change. Step continuity is preserved.",
    statusLabel: "Draft recovered",
    primaryAction: {
      id: "resume-draft",
      label: "Resume draft",
      shortcutHint: "Enter",
    },
    secondaryAction: {
      id: "discard-draft",
      label: "Discard draft",
      variant: "outline",
    },
  },
};

export const Reconnecting: Story = {
  args: {
    kind: "reconnecting",
    title: "Reconnecting to operational services",
    description:
      "Keep working in the current workflow. Sync will resume automatically when the connection is restored.",
    meta: "Background recovery is active. You do not need to reopen this queue.",
    primaryAction: {
      id: "retry-now",
      label: "Retry now",
      variant: "outline",
      isBusy: true,
    },
    secondaryAction: {
      id: "continue-review",
      label: "Continue review",
      variant: "ghost",
    },
  },
};
