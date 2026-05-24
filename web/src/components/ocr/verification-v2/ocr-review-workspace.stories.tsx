import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { OcrReviewWorkspace } from "@/components/ocr/verification-v2/ocr-review-workspace";
import type { OcrVerificationRecord } from "@/lib/ocr";

const activeRecord = {
  id: 2401,
  status: "pending",
  source_filename: "Inbound weighment slip 2401",
  updated_at: "2026-05-24T13:10:00Z",
  language: "eng",
} as OcrVerificationRecord;

const meta = {
  title: "OCR/OcrReviewWorkspace",
  component: OcrReviewWorkspace,
  tags: ["autodocs"],
  args: {
    activeRecord,
    detailFetching: false,
    imageUrl: "",
    headers: ["Heat", "Weight", "Supplier", "Remarks"],
    rows: [
      ["H-1001", "25.40", "Shree Steel Traders", ""],
      ["H-1002", "", "Shree Steel Traders", "weight unclear"],
    ],
    reviewSignals: [
      "Row 2, Weight is blank.",
      "Remarks needs confirmation before approval.",
    ],
    reviewerNotes: "Weight field checked against physical slip.",
    rejectionReason: "",
    onHeaderChange: () => undefined,
    onCellChange: () => undefined,
    onReviewerNotesChange: () => undefined,
    onRejectionReasonChange: () => undefined,
    onFocusTable: () => undefined,
  },
} satisfies Meta<typeof OcrReviewWorkspace>;

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
    <LoadingBoundary isLoading hasData={false} loadingTitle="Loading OCR workspace">
      <OcrReviewWorkspace {...args} />
    </LoadingBoundary>
  ),
};

export const EmptyPreview: Story = {
  args: {
    imageUrl: "",
    reviewSignals: [],
  },
};

export const ErrorState: Story = {
  render: (args) => (
    <LoadingBoundary
      isError
      hasData={false}
      error={new Error("OCR workspace could not refresh.")}
      onRetry={() => undefined}
    >
      <OcrReviewWorkspace {...args} />
    </LoadingBoundary>
  ),
};
