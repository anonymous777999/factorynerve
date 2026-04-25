import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorBannerProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "error" | "success";
  className?: string;
};

export function ErrorBanner({
  message,
  actionLabel,
  onAction,
  tone = "error",
  className,
}: ErrorBannerProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[24px] border px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between",
        tone === "success"
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-50"
          : "border-red-500/20 bg-red-500/10 text-red-50",
        className,
      )}
    >
      <p className="min-w-0 flex-1 leading-6">{message}</p>
      {actionLabel && onAction ? (
        <Button
          type="button"
          variant={tone === "success" ? "ghost" : "outline"}
          className="h-11 shrink-0 border-current/20 bg-white/5 px-4"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

