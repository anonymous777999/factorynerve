import { cn } from "@/lib/utils";

export function MetricTile({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "watch" | "critical";
}) {
  const toneClassName =
    tone === "critical"
      ? "border-status-danger-border bg-status-danger-bg"
      : tone === "watch"
        ? "border-status-warning-border bg-status-warning-bg"
        : "border-border-default bg-surface-panel";

  return (
    <div className={cn("rounded-panel border px-md py-sm", toneClassName)}>
      <div className="text-label-dense uppercase tracking-wide text-text-tertiary">{label}</div>
      <div className="mt-xs font-mono text-[var(--type-numeric-md)] leading-tight text-text-primary">
        {value}
      </div>
      <div className="mt-xs text-label-dense text-text-secondary">{detail}</div>
    </div>
  );
}
