"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatApiErrorMessage } from "@/lib/api";
import { cancelJob, retryJob } from "@/lib/jobs";
import { downloadOcrJob, type OcrJobPayload } from "@/lib/ocr";
import { pushAppToast } from "@/lib/toast";
import { triggerBlobDownload } from "@/lib/reports";

function formatTimestamp(value?: string | number) {
  if (!value) return "-";
  const timestamp = typeof value === "number" ? value * 1000 : value;
  return new Date(timestamp).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMetadata(job: OcrJobPayload | null) {
  const metadata = job?.result?.metadata;
  if (!metadata) return [] as Array<[string, string]>;
  if (job.kind === "ocr_ledger_excel") {
    return [
      ["Rows", String(metadata.total_rows ?? 0)],
      ["Dr Total", String(metadata.total_dr ?? 0)],
      ["Cr Total", String(metadata.total_cr ?? 0)],
      ["Difference", String(metadata.difference ?? 0)],
      ["Balanced", metadata.balanced ? "Yes" : "No"],
      ["Low Confidence Rows", String((metadata.low_confidence_rows as unknown[] | undefined)?.length ?? 0)],
    ];
  }
  return [
    ["Rows", String(metadata.total_rows ?? 0)],
    ["Columns", String(metadata.total_columns ?? 0)],
  ];
}

type OcrJobStatusPanelProps = {
  job: OcrJobPayload;
  onJobChange?: (job: OcrJobPayload) => void;
};

export function OcrJobStatusPanel({ job, onJobChange }: OcrJobStatusPanelProps) {
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const metadataRows = formatMetadata(job);

  const handleCancelCurrentJob = async () => {
    setBusy(true);
    setError("");
    try {
      const cancelled = (await cancelJob(job.job_id)) as OcrJobPayload;
      onJobChange?.(cancelled);
      setStatus(cancelled.status === "canceled" ? "OCR job cancelled." : "OCR cancellation requested.");
      pushAppToast({
        title: "OCR job cancelled",
        description: "You can retry it whenever you are ready.",
        tone: "info",
      });
    } catch (reason) {
      setError(formatApiErrorMessage(reason, "Could not cancel OCR job."));
    } finally {
      setBusy(false);
    }
  };

  const handleRetryCurrentJob = async () => {
    setBusy(true);
    setError("");
    try {
      const retried = (await retryJob(job.job_id)) as OcrJobPayload;
      onJobChange?.(retried);
      setStatus("OCR job retried. We are watching the fresh run now.");
      pushAppToast({
        title: "OCR job retried",
        description: "A new OCR run has been queued in the shared jobs system.",
        tone: "success",
      });
    } catch (reason) {
      setError(formatApiErrorMessage(reason, "Could not retry OCR job."));
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setDownloadBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await downloadOcrJob(job.job_id);
      triggerBlobDownload(result.blob, result.filename);
      setStatus(`Download started: ${result.filename}`);
    } catch (reason) {
      setError(formatApiErrorMessage(reason, "Could not download OCR result."));
    } finally {
      setDownloadBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Job Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
            <div className="text-[var(--muted)]">Status</div>
            <div className="mt-1 text-lg font-semibold">{job.status}</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
            <div className="text-[var(--muted)]">Progress</div>
            <div className="mt-1 text-lg font-semibold">{job.progress}%</div>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${Math.max(4, Math.min(100, Number(job.progress || 0)))}%` }}
          />
        </div>
        <div className="text-[var(--muted)]">{job.message}</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-[var(--muted)]">Created</div>
            <div>{formatTimestamp(job.created_at)}</div>
          </div>
          <div>
            <div className="text-[var(--muted)]">Updated</div>
            <div>{formatTimestamp(job.updated_at)}</div>
          </div>
        </div>
        {metadataRows.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {metadataRows.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <div className="text-[var(--muted)]">{label}</div>
                <div className="mt-1 text-lg font-semibold">{value}</div>
              </div>
            ))}
          </div>
        ) : null}
        {job.error ? (
          <div className="rounded-2xl border border-red-500/30 bg-[rgba(239,68,68,0.08)] p-4 text-red-300">
            {job.error}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {job.status === "succeeded" ? (
            <Button onClick={handleDownload} disabled={downloadBusy}>
              {downloadBusy ? "Preparing download..." : "Download Excel Result"}
            </Button>
          ) : null}
          {["queued", "running", "canceling"].includes(job.status) ? (
            <Button variant="outline" onClick={handleCancelCurrentJob} disabled={busy}>
              {busy || job.status === "canceling" ? "Stopping..." : "Cancel Job"}
            </Button>
          ) : null}
          {["failed", "canceled"].includes(job.status) ? (
            <Button variant="outline" onClick={handleRetryCurrentJob} disabled={busy}>
              {busy ? "Retrying..." : "Retry Job"}
            </Button>
          ) : null}
        </div>
        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {error ? <div className="text-sm text-red-400">{error}</div> : null}
      </CardContent>
    </Card>
  );
}
