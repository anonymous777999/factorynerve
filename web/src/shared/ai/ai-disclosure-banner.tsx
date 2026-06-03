"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AiDisclosureBannerProps = {
  source: string;
  lowConfidenceCount?: number;
  totalCount?: number;
  reviewHref?: string;
  className?: string;
};

export function AiDisclosureBanner({
  source,
  lowConfidenceCount = 0,
  totalCount = 0,
  reviewHref,
  className,
}: AiDisclosureBannerProps) {
  const needsReview = lowConfidenceCount > 0;

  return (
    <div
      className={cn(
        "rounded-panel border px-md py-sm text-sm leading-6",
        needsReview
          ? "border-status-warning-border bg-status-warning-bg text-status-warning-fg status-glow-warning"
          : "border-status-processing-border bg-status-processing-bg text-status-processing-fg",
        className,
      )}
      role="status"
    >
      <span className="font-medium">{source}</span>
      {totalCount > 0 ? (
        <span className="text-text-secondary">
          {" "}
          · {lowConfidenceCount} of {totalCount} below confidence threshold
        </span>
      ) : null}
      {needsReview && reviewHref ? (
        <div className="mt-sm">
          <Link href={reviewHref}>
            <Button size="compact" variant="outline" type="button">
              Review before export
            </Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
