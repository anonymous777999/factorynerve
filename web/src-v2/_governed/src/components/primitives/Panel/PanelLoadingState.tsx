import { cx } from "../../../../lib/utils";
import type { PanelLoadingStateProps } from "./panel.types";

function SkeletonLine({ tone = "default", width }: { tone?: "default" | "ai"; width: string }) {
  const shimmerTone =
    tone === "ai"
      ? "from-transparent via-[var(--prim-blue-900)] to-transparent"
      : "from-transparent via-[var(--color-surface-raised)] to-transparent";

  return (
    <div className="relative h-[12px] overflow-hidden rounded-[2px] bg-[var(--color-surface-overlay)]" style={{ width }}>
      <div
        className={cx(
          "absolute inset-0 animate-[fn-shimmer_1200ms_linear_infinite] bg-[length:200%_100%] bg-gradient-to-r",
          shimmerTone
        )}
      />
    </div>
  );
}

export function PanelLoadingState({
  rows = 5,
  tone = "default",
  className,
  ...props
}: PanelLoadingStateProps) {
  return (
    <div className={cx("flex flex-col gap-[var(--spacing-4)]", className)} {...props}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-primary)] p-[var(--spacing-4)]"
        >
          <div className="flex flex-col gap-[var(--spacing-3)]">
            <SkeletonLine tone={tone} width="42%" />
            <SkeletonLine tone={tone} width="86%" />
            <SkeletonLine tone={tone} width="68%" />
          </div>
        </div>
      ))}
    </div>
  );
}
