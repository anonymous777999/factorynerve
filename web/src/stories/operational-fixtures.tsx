import * as React from "react";

import { Button } from "@/components/ui/button";
import { Field, HelperText, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type PrimitiveAction = {
  id: string;
  label: string;
  shortcutHint?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
  isBusy?: boolean;
};

export const approvalActions: PrimitiveAction[] = [
  { id: "approve", label: "Approve", shortcutHint: "Ctrl+Enter" },
  { id: "reject", label: "Reject", variant: "outline", shortcutHint: "Esc" },
  { id: "assign", label: "Escalate", variant: "ghost" },
];

export const reconciliationActions: PrimitiveAction[] = [
  { id: "close-gap", label: "Close variance" },
  { id: "hold", label: "Hold batch", variant: "outline" },
  { id: "export", label: "Export variance note", variant: "ghost" },
];

export const workstationMetrics = [
  { id: "queue", label: "Open queue", value: "128", detail: "19 above SLA", tone: "warning" as const },
  { id: "approval", label: "Awaiting approval", value: "41", detail: "OCR + attendance", tone: "processing" as const },
  { id: "recon", label: "Reconciliation drift", value: "2.8 t", detail: "4 batches", tone: "error" as const },
  { id: "sync", label: "Sync health", value: "99.2%", detail: "Last poll 42s ago", tone: "synced" as const },
];

export const approvalFacts = [
  { label: "Batch", value: "B-2405-17" },
  { label: "Supplier", value: "Shree Steel Traders" },
  { label: "Received", value: "24 May 2026, 18:10" },
  { label: "Variance", value: "1.25 t short" },
];

export const filterFields = [
  {
    id: "site",
    label: "Site",
    type: "select" as const,
    value: "hazira",
    options: [
      { label: "Hazira melt shop", value: "hazira" },
      { label: "Kheda yard", value: "kheda" },
      { label: "Pune line 2", value: "pune" },
    ],
    onValueChange: () => undefined,
  },
  {
    id: "status",
    label: "Status",
    type: "select" as const,
    value: "pending",
    options: [
      { label: "Pending", value: "pending" },
      { label: "Approved", value: "approved" },
      { label: "Escalated", value: "escalated" },
    ],
    onValueChange: () => undefined,
  },
  {
    id: "search",
    label: "Search",
    type: "text" as const,
    value: "B-2405",
    placeholder: "Batch, GRN, or vehicle",
    onValueChange: () => undefined,
  },
  {
    id: "date",
    label: "Cutoff",
    type: "date" as const,
    value: "2026-05-24",
    onValueChange: () => undefined,
  },
];

export const activeFilters = [
  { id: "queue", label: "Queue", value: "Approval lane", onClear: () => undefined },
  { id: "sla", label: "SLA", value: "Over 8h", onClear: () => undefined },
];

export const queueTableRows = Array.from({ length: 12 }, (_, index) => ({
  id: `Q-${String(index + 1).padStart(3, "0")}`,
  lane: index % 3 === 0 ? "OCR" : index % 3 === 1 ? "Approval" : "Reconciliation",
  document: index % 2 === 0 ? "Inbound weighment slip" : "Shift closure packet",
  station: index % 4 === 0 ? "Hazira melt shop" : "Kheda yard",
  owner: index % 2 === 0 ? "A. Patel" : "R. Singh",
  age: `${3 + index}h`,
  variance: `${(index * 0.15 + 0.4).toFixed(2)} t`,
  status:
    index % 5 === 0
      ? "warning"
      : index % 4 === 0
        ? "processing"
        : index % 7 === 0
          ? "paused"
          : "success",
}));

export function DenseReviewForm() {
  return (
    <div className="grid gap-md lg:grid-cols-2">
      <Field>
        <Label htmlFor="material-code">Material code</Label>
        <Input id="material-code" defaultValue="MTL-4421" readOnly />
        <HelperText>Back-end batch master remains the source of truth.</HelperText>
      </Field>
      <Field>
        <Label htmlFor="supplier-name">Supplier</Label>
        <Input id="supplier-name" defaultValue="Shree Steel Traders" readOnly />
        <HelperText>Supplier mismatch requires manager approval.</HelperText>
      </Field>
      <Field>
        <Label htmlFor="weighment">Weighment variance</Label>
        <Input id="weighment" defaultValue="-1.25 t" readOnly data-mono="true" />
      </Field>
      <Field>
        <Label htmlFor="queue-owner">Queue owner</Label>
        <Input id="queue-owner" defaultValue="Reconciliation desk" readOnly />
      </Field>
      <Field className="lg:col-span-2">
        <Label htmlFor="review-note">Review note</Label>
        <Textarea
          id="review-note"
          defaultValue="Supplier slip handwriting is weak. Cross-check against weighbridge export before approval."
          rows={4}
        />
      </Field>
    </div>
  );
}

export function ActionRow() {
  return (
    <div className="flex flex-wrap gap-sm">
      <Button size="compact">Approve</Button>
      <Button size="compact" variant="outline">
        Reject
      </Button>
      <Button size="compact" variant="ghost">
        Save note
      </Button>
    </div>
  );
}
