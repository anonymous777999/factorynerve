import type { ReactNode } from "react";

import { Badge, type BadgeStatus } from "@/components/ui/badge";
import { OcrNotificationDropdown } from "@/components/ocr/ocr-notification-dropdown";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
};

type OcrShellProps = {
  title: string;
  subtitle: string;
  step: "entry" | "prepare" | "processing" | "result";
  children: ReactNode;
  sideContent?: ReactNode;
  mobile?: boolean;
  className?: string;
  notifications?: Notification[];
  onDismissNotification?: (id: string) => void;
};

const STEP_LABELS: Array<{ key: OcrShellProps["step"]; label: string }> = [
  { key: "entry", label: "Upload" },
  { key: "prepare", label: "Prepare" },
  { key: "processing", label: "Review" },
  { key: "result", label: "Export" },
];

const shellStatusMap: Record<OcrShellProps["step"], { label: string; status: BadgeStatus }> = {
  entry: { label: "Intake ready", status: "draft" },
  prepare: { label: "Draft setup", status: "paused" },
  processing: { label: "Review active", status: "processing" },
  result: { label: "Output ready", status: "synced" },
};

export function OcrShell({
  title,
  subtitle,
  step,
  children,
  sideContent,
  className,
  notifications = [],
  onDismissNotification,
}: OcrShellProps) {
  const activeIndex = STEP_LABELS.findIndex((item) => item.key === step);
  const shellStatus = shellStatusMap[step];

  return (
    <main className="factory-ocr-scope flex flex-1 flex-col px-4 py-4 md:px-6 md:py-5" style={{ border: "3px solid orange", background: "rgba(255,165,0,0.1)" }}>
      <div className="factory-ocr-shell flex min-h-0 flex-1 flex-col" style={{ border: "3px solid blue", background: "rgba(0,0,255,0.1)" }}>
        <section className="factory-ocr-header flex-shrink-0" style={{ border: "2px solid green", background: "rgba(0,255,0,0.1)" }}>
          <div className="factory-ocr-header__meta">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="factory-ocr-header__eyebrow">OCR Workstation</span>
                <Badge status={shellStatus.status}>{shellStatus.label}</Badge>
              </div>
              <h1 className="factory-ocr-header__title">{title}</h1>
              <p className="factory-ocr-header__subtitle">{subtitle}</p>
            </div>
            <div className="flex items-start gap-4">
              <div className="factory-ocr-telemetry">
                <div className="factory-ocr-telemetry__item">
                  <div className="factory-ocr-telemetry__label">Mode</div>
                  <div className="factory-ocr-telemetry__value">Queue-oriented review</div>
                </div>
                <div className="factory-ocr-telemetry__item">
                  <div className="factory-ocr-telemetry__label">Priority</div>
                  <div className="factory-ocr-telemetry__value">Operator throughput</div>
                </div>
                <div className="factory-ocr-telemetry__item">
                  <div className="factory-ocr-telemetry__label">State</div>
                  <div className="factory-ocr-telemetry__value">{shellStatus.label}</div>
                </div>
              </div>
              <OcrNotificationDropdown
                notifications={notifications}
                onDismiss={onDismissNotification}
              />
            </div>
          </div>
          <div className="factory-ocr-stagebar">
            {STEP_LABELS.map((item, index) => {
              const state = index < activeIndex ? "done" : index === activeIndex ? "current" : "idle";
              return (
                <div key={item.key} className="factory-ocr-stagepill" data-state={state}>
                  <span className="factory-ocr-stagepill__index">{index + 1}</span>
                  <span className="factory-ocr-stagepill__label">{item.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section
          className={cn(
            "factory-ocr-history-layout min-h-0 flex-1",
            className,
          )}
          style={{ border: "3px solid purple", background: "rgba(128,0,128,0.1)" }}
        >
          <div className="factory-ocr-console rounded-[0.45rem] p-4 md:p-5" style={{ border: "3px solid pink", background: "rgba(255,192,203,0.2)" }}>
            {children}
          </div>
          {sideContent ? (
            <aside className="space-y-4">
              {sideContent}
            </aside>
          ) : null}
        </section>
      </div>
    </main>
  );
}
