"use client";

import { useMemo } from "react";
import { type OcrPreviewResult } from "@/lib/ocr";
import { SectionedReviewShell, buildSection, type ReviewSection } from "./SectionedReviewShell";

interface GRNReviewViewProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  className?: string;
}

function getGRNSections(data: OcrPreviewResult): ReviewSection[] {
  const { headers = [] } = data;
  const headerIndices: number[] = [];
  const itemIndices: number[] = [];
  const qcIndices: number[] = [];

  headers.forEach((header, index) => {
    const h = header.toLowerCase();
    if (/grn|goods|receipt|date|number|vendor|supplier|po|purchase|order|challan|delivery|store|warehouse|location/i.test(h)) {
      headerIndices.push(index);
    } else if (/qc|quality|inspect|test|spec|tolerance|defect|pass|fail|grade|certificate|approval/i.test(h)) {
      qcIndices.push(index);
    } else {
      itemIndices.push(index);
    }
  });

  return [
    buildSection("header", "Header", "header", data, headerIndices),
    buildSection("items", "Items", "table", data, itemIndices),
    buildSection("qc", "Quality Check", "table", data, qcIndices),
  ];
}

export function GRNReviewView({
  data,
  onCellChange,
  onHeaderChange,
  className,
}: GRNReviewViewProps) {
  const sections = useMemo(() => getGRNSections(data), [data]);
  return (
    <SectionedReviewShell
      title="Goods Receipt Note"
      data={data}
      sections={sections}
      onCellChange={onCellChange}
      onHeaderChange={onHeaderChange}
      className={className}
    />
  );
}
