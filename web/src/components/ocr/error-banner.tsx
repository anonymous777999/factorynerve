import { RecoveryBanner } from "@/components/ui/recovery-banner";

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
}: ErrorBannerProps) {
  return (
    <RecoveryBanner
      kind={tone === "success" ? "reconnecting" : "sync-failure"}
      statusLabel={tone === "success" ? "Workflow update" : "Workflow issue"}
      title={message}
      primaryAction={
        actionLabel && onAction
          ? {
              id: `${tone}-action`,
              label: actionLabel,
              onAction,
              variant: tone === "success" ? "ghost" : "outline",
            }
          : undefined
      }
    />
  );
}
