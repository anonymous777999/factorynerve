"use client";

import { useMemo } from "react";
import { type OcrPreviewResult } from "@/lib/ocr";
import { SectionedReviewShell, buildSection, type ReviewSection } from "./SectionedReviewShell";

interface PurchaseOrderReviewViewProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  className?: string;
}

function getPOSections(data: OcrPreviewResult): ReviewSection[] {
  const { headers = [] } = data;
  const headerIndices: number[] = [];
  const itemIndices: number[] = [];
  const termsIndices: number[] = [];

  headers.forEach((header, index) => {
    const h = header.toLowerCase();
    if (/po|purchase|order|date|number|vendor|supplier|buyer|gstin|place|supply|currency|payment|delivery|terms/i.test(h)) {
      headerIndices.push(index);
    } else if (/term|condition|warranty|penalty|liquidat|force|majeure|arbitrat|jurisdiction|validity/i.test(h)) {
      termsIndices.push(index);
    } else {
      itemIndices.push(index);
    }
  });

  return [
    buildSection("header", "Header", "header", data, headerIndices),
    buildSection("items", "Line Items", "table", data, itemIndices),
    buildSection("terms", "Terms", "table", data, termsIndices),
  ];
}

export function PurchaseOrderReviewView({
  data,
  onCellChange,
  onHeaderChange,
  className,
}: PurchaseOrderReviewViewProps) {
  const sections = useMemo(() => getPOSections(data), [data]);
  return (
    <SectionedReviewShell
      title="Purchase Order"
      data={data}
      sections={sections}
      onCellChange={onCellChange}
      onHeaderChange={onHeaderChange}
      className={className}
    />
  );
}
