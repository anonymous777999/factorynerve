import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { OcrVerificationQueueTable } from "@/components/ocr/verification-v2/ocr-verification-queue-table";

const rows = [
  {
    id: "ocr-2401",
    verificationId: 2401,
    document: "Inbound weighment slip 2401",
    template: "Steel GRN",
    status: "pending" as const,
    warnings: "2 warnings",
    updatedAt: "24 May, 18:40",
    reviewState: "Ready for approval",
  },
  {
    id: "ocr-2402",
    verificationId: 2402,
    document: "Dispatch challan 2402",
    template: "Dispatch sheet",
    status: "draft" as const,
    warnings: "Clean read",
    updatedAt: "24 May, 17:55",
    reviewState: "Draft in review",
  },
  {
    id: "ocr-2403",
    verificationId: 2403,
    document: "Inventory tally 2403",
    template: "Inventory ledger",
    status: "rejected" as const,
    warnings: "4 warnings",
    updatedAt: "24 May, 16:10",
    reviewState: "Sent back",
  },
];

const meta = {
  title: "OCR/OcrVerificationQueueTable",
  component: OcrVerificationQueueTable,
  tags: ["autodocs"],
  args: {
    rows,
    activeVerificationId: 2401,
    onOpenRecord: () => undefined,
  },
} satisfies Meta<typeof OcrVerificationQueueTable>;

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
    <LoadingBoundary isLoading hasData={false} loadingTitle="Loading OCR queue">
      <OcrVerificationQueueTable {...args} />
    </LoadingBoundary>
  ),
};

export const Empty: Story = {
  args: {
    rows: [],
  },
};

export const ErrorState: Story = {
  render: (args) => (
    <LoadingBoundary
      isError
      hasData={false}
      error={new Error("OCR queue failed to load.")}
      onRetry={() => undefined}
    >
      <OcrVerificationQueueTable {...args} />
    </LoadingBoundary>
  ),
};
