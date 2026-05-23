import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LoadingBoundaryProps = {
  children: React.ReactNode;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  hasData?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  loadingFallback?: React.ReactNode;
  emptyFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  loadingTitle?: string;
  loadingMessage?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  errorTitle?: string;
  errorMessage?: string;
  retryLabel?: string;
  loadingRows?: number;
  className?: string;
  contentClassName?: string;
};

type LoadingStateSkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  rows?: number;
  title?: string;
  description?: string;
};

export function LoadingStateSkeleton({
  className,
  description = "Fetching current data.",
  rows = 5,
  title = "Loading workspace",
  ...props
}: LoadingStateSkeletonProps) {
  return (
    <Card className={cn("border-border-subtle bg-surface-panel shadow-none", className)} {...props}>
      <CardHeader className="pb-sm">
        <Badge status="processing">Loading</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-md pt-0">
        <div className="space-y-sm">
          <div className="space-y-xs">
            <p className="text-panel-title font-semibold text-text-primary">{title}</p>
            <p className="text-body text-text-secondary">{description}</p>
          </div>
          <div className="space-y-xs" aria-hidden="true">
            <Skeleton className="h-input w-1/3 rounded-control" />
            <Skeleton className="h-row w-2/3 rounded-control" />
          </div>
        </div>
        <div className="space-y-sm" aria-hidden="true">
          {Array.from({ length: rows }).map((_, index) => (
            <Skeleton key={index} className="h-row w-full rounded-control" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingNotice({
  isError,
  isFetching,
  isRetrying = false,
  onRetry,
  retryLabel = "Retry",
}: Pick<
  LoadingBoundaryProps,
  "isError" | "isFetching" | "isRetrying" | "onRetry" | "retryLabel"
>) {
  if (!isFetching && !isError) {
    return null;
  }

  const showRetry = isError && typeof onRetry === "function";

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-sm rounded-panel border border-border-subtle bg-surface-panel px-md py-sm"
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      <div className="flex min-w-0 items-center gap-sm">
        <Badge status={isError ? "error" : "processing"}>
          {isError ? "Update failed" : "Refreshing"}
        </Badge>
        <p className="min-w-0 text-body text-text-secondary">
          {isError
            ? "Refresh failed. Retry when ready."
            : "Updating in the background."}
        </p>
      </div>
      {showRetry ? (
        <Button
          variant="outline"
          size="compact"
          onClick={onRetry}
          isBusy={isRetrying}
          busyLabel="Retrying"
        >
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingBoundary({
  children,
  className,
  contentClassName,
  emptyFallback,
  emptyMessage = "Adjust filters or add a record.",
  emptyTitle = "No records",
  error,
  errorFallback,
  errorMessage,
  errorTitle = "This view could not be refreshed",
  hasData = false,
  isEmpty = false,
  isError = false,
  isFetching = false,
  isLoading = false,
  isRetrying = false,
  loadingFallback,
  loadingMessage,
  loadingRows = 5,
  loadingTitle,
  onRetry,
  retryLabel = "Retry",
}: LoadingBoundaryProps) {
  const showLoadingState = isLoading && !hasData;
  const showErrorState = isError && !hasData;
  const showEmptyState = isEmpty && !showLoadingState && !showErrorState;

  if (showLoadingState) {
    return (
      <div className={className} aria-busy="true">
        {loadingFallback ?? (
          <LoadingStateSkeleton
            rows={loadingRows}
            title={loadingTitle}
            description={loadingMessage}
          />
        )}
      </div>
    );
  }

  if (showErrorState) {
    return (
      <div className={className}>
        {errorFallback ?? (
          <EmptyState
            status="error"
            statusLabel="Load failed"
            title={errorTitle}
            description={errorMessage ?? error?.message ?? "Could not load data. Retry when ready."}
            action={
              onRetry ? (
                <Button
                  variant="outline"
                  onClick={onRetry}
                  isBusy={isRetrying}
                  busyLabel="Retrying"
                >
                  {retryLabel}
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    );
  }

  if (showEmptyState) {
    return (
      <div className={className}>
        {emptyFallback ?? (
          <EmptyState
            title={emptyTitle}
            description={emptyMessage}
            status="draft"
            statusLabel="No records"
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-sm", className)} aria-busy={isFetching ? "true" : undefined}>
      <LoadingNotice
        isError={isError}
        isFetching={isFetching}
        isRetrying={isRetrying}
        onRetry={onRetry}
        retryLabel={retryLabel}
      />
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
