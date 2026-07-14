"use client";

import { useMemo } from "react";
import { type OcrPreviewResult } from "@/lib/ocr";
import { SectionedReviewShell, buildSection, type ReviewSection } from "./SectionedReviewShell";

interface DeliveryNoteReviewViewProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  className?: string;
}

function getDeliveryNoteSections(data: OcrPreviewResult): ReviewSection[] {
  const { headers = [] } = data;
  const headerIndices: number[] = [];
  const itemIndices: number[] = [];
  const vehicleIndices: number[] = [];

  headers.forEach((header, index) => {
    const h = header.toLowerCase();
    if (/delivery|date|number|challan|party|customer|vendor|gstin|place|supply|order|po/i.test(h)) {
      headerIndices.push(index);
    } else if (/vehicle|truck|transporter|driver|license|registration|capacity/i.test(h)) {
      vehicleIndices.push(index);
    } else {
      itemIndices.push(index);
    }
  });

  return [
    buildSection("header", "Header", "header", data, headerIndices),
    buildSection("items", "Items", "table", data, itemIndices),
    buildSection("vehicle", "Vehicle", "table", data, vehicleIndices),
  ];
}

export function DeliveryNoteReviewView({
  data,
  onCellChange,
  onHeaderChange,
  className,
}: DeliveryNoteReviewViewProps) {
  const sections = useMemo(() => getDeliveryNoteSections(data), [data]);
  return (
    <SectionedReviewShell
      title="Delivery Note"
      data={data}
      sections={sections}
      onCellChange={onCellChange}
      onHeaderChange={onHeaderChange}
      className={className}
    />
  );
}
