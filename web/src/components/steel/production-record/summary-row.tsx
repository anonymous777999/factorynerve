import { cn } from "@/lib/utils";

export function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-sm border-b border-border-subtle py-sm last:border-b-0">
      <span className="text-label-dense text-text-secondary">{label}</span>
      <span className={cn("text-label text-text-primary", mono ? "font-mono" : "")}>{value}</span>
    </div>
  );
}
