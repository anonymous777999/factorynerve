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
      ? "border-red-800 bg-red-950/30"
      : tone === "watch"
        ? "border-orange-800 bg-orange-950/30"
        : "border-gray-700 bg-[#0f1419]";

  return (
    <div className={cn("rounded-lg border px-4 py-3", toneClassName)}>
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold leading-tight text-white">
        {value}
      </div>
      <div className="mt-1 text-xs text-gray-400">{detail}</div>
    </div>
  );
}
