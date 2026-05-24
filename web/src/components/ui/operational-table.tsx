import * as React from "react";
import type { RowData } from "@tanstack/react-table";

import { DataTable, type DataTableProps } from "@/components/ui/data-table/data-table";
import { SectionPanel } from "@/components/ui/section-panel";

export type OperationalTableProps<TData extends RowData> = DataTableProps<TData> & {
  title: string;
  description?: string;
  eyebrow?: string;
  toneLabel?: string;
  headerMeta?: React.ReactNode;
};

export function OperationalTable<TData extends RowData>({
  description,
  eyebrow,
  headerMeta,
  title,
  toneLabel,
  ...props
}: OperationalTableProps<TData>) {
  return (
    <SectionPanel
      title={title}
      description={description}
      eyebrow={eyebrow}
      tone={toneLabel ? "processing" : "default"}
      toneLabel={toneLabel}
      meta={headerMeta}
      bodyClassName="p-0"
    >
      <DataTable {...props} />
    </SectionPanel>
  );
}
