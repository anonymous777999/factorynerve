"use client";

import { useMemo } from "react";
import { type OcrPreviewResult } from "@/lib/ocr";
import { SectionedReviewShell, buildSection, type ReviewSection } from "./SectionedReviewShell";

interface ProductionReportViewProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  className?: string;
}

function getProductionSections(data: OcrPreviewResult): ReviewSection[] {
  const { headers = [] } = data;
  const headerIndices: number[] = [];
  const machineIndices: number[] = [];
  const outputIndices: number[] = [];
  const qualityIndices: number[] = [];
  const downtimeIndices: number[] = [];

  headers.forEach((header, index) => {
    const h = header.toLowerCase();
    if (/date|shift|operator|supervisor|line|machine|id|code|name/i.test(h)) {
      headerIndices.push(index);
    } else if (/machine|equipment|press|line|unit|asset/i.test(h)) {
      machineIndices.push(index);
    } else if (/quality|reject|defect|scrap|pass|fail|conform|spec/i.test(h)) {
      qualityIndices.push(index);
    } else if (/down|break|stop|idle|wait|setup|changeover|maintenance/i.test(h)) {
      downtimeIndices.push(index);
    } else {
      outputIndices.push(index);
    }
  });

  return [
    buildSection("header", "Header", "header", data, headerIndices),
    buildSection("machine", "Machine", "table", data, machineIndices),
    buildSection("output", "Output", "table", data, outputIndices),
    buildSection("quality", "Quality", "table", data, qualityIndices),
    buildSection("downtime", "Downtime", "table", data, downtimeIndices),
  ];
}

export function ProductionReportView({
  data,
  onCellChange,
  onHeaderChange,
  className,
}: ProductionReportViewProps) {
  const sections = useMemo(() => getProductionSections(data), [data]);
  return (
    <SectionedReviewShell
      title="Production Report"
      data={data}
      sections={sections}
      onCellChange={onCellChange}
      onHeaderChange={onHeaderChange}
      className={className}
    />
  );
}
