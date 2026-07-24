"use client";

import { useMemo } from "react";
import { type OcrPreviewResult } from "@/lib/ocr";
import { SectionedReviewShell, buildSection, type ReviewSection } from "./SectionedReviewShell";

interface InvoiceReviewViewProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  className?: string;
}

function getInvoiceSections(data: OcrPreviewResult): ReviewSection[] {
  const { headers = [] } = data;
  const headerIndices: number[] = [];
  const itemIndices: number[] = [];
  const taxIndices: number[] = [];
  const totalIndices: number[] = [];

  headers.forEach((header, index) => {
    const h = header.toLowerCase();
    if (/tax|gst|cgst|sgst|igst|cess/i.test(h)) {
      taxIndices.push(index);
    } else if (/total|grand|net|payable|round|discount|balance/i.test(h)) {
      totalIndices.push(index);
    } else if (/invoice|date|number|party|customer|vendor|gstin|pan|place|supply|vehicle|challan|eway|bill/i.test(h)) {
      headerIndices.push(index);
    } else {
      itemIndices.push(index);
    }
  });

  return [
    buildSection("header", "Header", "header", data, headerIndices),
    buildSection("items", "Line Items", "table", data, itemIndices),
    buildSection("tax", "Tax Breakdown", "table", data, taxIndices),
    buildSection("totals", "Totals", "totals", data, totalIndices),
  ];
}

export function InvoiceReviewView({
  data,
  onCellChange,
  onHeaderChange,
  className,
}: InvoiceReviewViewProps) {
  const sections = useMemo(() => getInvoiceSections(data), [data]);
  return (
    <SectionedReviewShell
      title="Invoice"
      data={data}
      sections={sections}
      onCellChange={onCellChange}
      onHeaderChange={onHeaderChange}
      className={className}
    />
  );
}
