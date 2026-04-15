"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { transferBlob } from "@/lib/blob-transfer";
import { cancelJob, listJobs, retryJob, type JobRecord, type JobStatus } from "@/lib/jobs";
import { pushAppToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const ACTIVE_STATUSES = new Set<JobStatus>(["queued", "running", "canceling"]);

function progressWidth(progress?: number) {
  return `${Math.max(4, Math.min(100, Number(progress || 0)))}%`;
}

function jobTone(status: JobStatus) {
  if (status === "failed") return "text-red-400";
  if (status === "succeeded") return "text-emerald-400";
  if (status === "canceled") return "text-amber-300";
  return "text-[var(--accent)]";
}

function jobTitle(kind: string) {
  switch (kind) {
    case "reports_excel_range":
      return "Range Excel Export";
    case "reports_entry_pdf":
      return "Entry PDF Export";
    case "ai_executive_summary":
      return "Executive AI Summary";
    case "entry_summary":
      return "Entry AI Summary";
    case "ocr_ledger_excel":
      return "Ledger OCR Export";
    case "ocr_table_excel":
      return "Table OCR Export";
    default:
      return kind.replaceAll("_", " ");
  }
}

function getDownloadPath(job: JobRecord) {
  if (job.kind.startsWith("reports_")) {
    return `/api/reports/export-jobs/${job.job_id}/download`;
  }
  if (job.kind.startsWith("ocr_")) {
    return `/api/ocr/jobs/${job.job_id}/download`;
  }
  return null;
}

function getOpenLink(job: JobRecord) {
  return job.context?.route || null;
}

async function downloadJob(job: JobRecord) {
  const downloadPath = getDownloadPath(job);
  if (!downloadPath) {
    throw new Error("This job does not expose a downloadable file.");
  }
  const response = await fetch(downloadPath, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Could not download the completed job file.");
  }
  const blob = await response.blob();
  const filename =
    response.headers
      .get("content-disposition")
      ?.split("filename=")[1]
      ?.replaceAll('"', "")
      ?.trim() ||
    String((job.result as { file?: { filename?: string } } | null)?.file?.filename || `job-${job.job_id}.bin`);
  await transferBlob(blob, filename, {
    title: jobTitle(job.kind),
    text: "Background export is ready to share or save.",
  });
}

function buildToastForTransition(job: JobRecord) {
  const openLink = getOpenLink(job);
  if (job.status === "succeeded") {
    return {
      title: `${jobTitle(job.kind)} complete`,
      description: job.message || "The result is ready.",
      tone: "success" as const,
      actionHref: openLink || undefined,
      actionLabel: openLink ? "Open" : undefined,
    };
  }
  if (job.status === "failed") {
    return {
      title: `${jobTitle(job.kind)} failed`,
      description: job.error || job.message || "Job failed.",
      tone: "error" as const,
      actionHref: openLink || undefined,
      actionLabel: openLink ? "Review" : undefined,
    };
  }
  if (job.status === "canceled") {
    return {
      title: `${jobTitle(job.kind)} canceled`,
      description: "The queued job was stopped before completion.",
      tone: "info" as const,
      actionHref: openLink || undefined,
      actionLabel: openLink ? "Open" : undefined,
    };
  }
  return null;
}

export function JobsDrawer() {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionKey, setActionKey] = useState<string | null>(null);
  const seenStatuses = useRef<Map<string, JobStatus>>(new Map());

  const loadJobs = useCallback(async () => {
    try {
      const next = await listJobs(12);
      setJobs(next);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load job activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  const activeCount = useMemo(
    () => jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).length,
    [jobs],
  );
  const shouldPoll = open || activeCount > 0;

  useEffect(() => {
    loadJobs().catch(() => undefined);
  }, [loadJobs]);

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }
    const interval = window.setInterval(() => {
      loadJobs().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(interval);
  }, [loadJobs, shouldPoll]);

  useEffect(() => {
    const snapshot = seenStatuses.current;
    jobs.forEach((job) => {
      const previous = snapshot.get(job.job_id);
      if (previous && previous !== job.status) {
        const toast = buildToastForTransition(job);
        if (toast) {
          pushAppToast(toast);
        }
      }
      snapshot.set(job.job_id, job.status);
    });
  }, [jobs]);

  const handleCancel = useCallback(
    async (job: JobRecord) => {
      const nextKey = `${job.job_id}:cancel`;
      setActionKey(nextKey);
      setError("");
      try {
        const updated = await cancelJob(job.job_id);
        setJobs((current) =>
          current.map((item) => (item.job_id === updated.job_id ? updated : item)),
        );
        pushAppToast({
          title: `${jobTitle(job.kind)} cancel requested`,
          description:
            updated.status === "canceled"
              ? "The queued job stopped immediately."
              : "We flagged the running job to stop as soon as it reaches a safe checkpoint.",
          tone: "info",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not cancel this job.";
        setError(message);
        pushAppToast({
          title: `Could not cancel ${jobTitle(job.kind)}`,
          description: message,
          tone: "error",
        });
      } finally {
        setActionKey(null);
      }
    },
    [],
  );

  const handleRetry = useCallback(
    async (job: JobRecord) => {
      const nextKey = `${job.job_id}:retry`;
      setActionKey(nextKey);
      setError("");
      try {
        const queued = await retryJob(job.job_id);
        pushAppToast({
          title: `${jobTitle(job.kind)} retried`,
          description: "Job queued.",
          tone: "success",
          actionHref: getOpenLink(queued) || undefined,
          actionLabel: getOpenLink(queued) ? "Open" : undefined,
        });
        await loadJobs();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not retry this job.";
        setError(message);
        pushAppToast({
          title: `Could not retry ${jobTitle(job.kind)}`,
          description: message,
          tone: "error",
        });
      } finally {
        setActionKey(null);
      }
    },
    [loadJobs],
  );

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-between rounded-2xl"
        onClick={() => setOpen((value) => !value)}
      >
        <span>Jobs</span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs",
            activeCount
              ? "border-[rgba(62,166,255,0.35)] text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--muted)]",
          )}
        >
          {activeCount ? `${activeCount} active` : `${jobs.length} recent`}
        </span>
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(3,8,20,0.6)]"
            onClick={() => setOpen(false)}
            aria-label="Close jobs drawer"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-[var(--border)] bg-[rgba(10,14,22,0.98)] p-5 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Background Jobs</div>
                <h2 className="mt-2 text-2xl font-semibold">Track exports and AI work</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  You can leave the current page and still watch reports, summaries, and OCR jobs finish here.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>

            <div className="mt-6 space-y-3 overflow-y-auto pr-1">
              {loading ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  Loading recent jobs...
                </div>
              ) : null}

              {!loading && !jobs.length ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  No background jobs yet. Exports, OCR runs, and AI summaries will appear here automatically.
                </div>
              ) : null}

              {jobs.map((job) => {
                const isCanceling = actionKey === `${job.job_id}:cancel`;
                const isRetrying = actionKey === `${job.job_id}:retry`;
                return (
                  <div
                    key={job.job_id}
                    className="rounded-2xl border border-[var(--border)] bg-[rgba(20,24,36,0.82)] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold">{jobTitle(job.kind)}</div>
                        <div className={cn("mt-1 text-xs uppercase tracking-[0.18em]", jobTone(job.status))}>
                          {job.status}
                        </div>
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {new Date(job.updated_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: progressWidth(job.progress) }} />
                    </div>
                    <div className="mt-3 text-sm text-[var(--text)]">{job.message}</div>
                    {job.error ? <div className="mt-2 text-sm text-red-400">{job.error}</div> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getOpenLink(job) ? (
                        <Link href={getOpenLink(job)!}>
                          <Button variant="outline" className="h-8 px-3 text-xs">
                            Open
                          </Button>
                        </Link>
                      ) : null}
                      {getDownloadPath(job) && job.status === "succeeded" ? (
                        <Button
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() =>
                            downloadJob(job).catch((err) => {
                              const message = err instanceof Error ? err.message : "Download failed.";
                              setError(message);
                              pushAppToast({
                                title: `Could not download ${jobTitle(job.kind)}`,
                                description: message,
                                tone: "error",
                              });
                            })
                          }
                        >
                          Download
                        </Button>
                      ) : null}
                      {job.can_cancel ? (
                        <Button
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          disabled={isCanceling}
                          onClick={() => handleCancel(job)}
                        >
                          {isCanceling ? "Canceling..." : "Cancel"}
                        </Button>
                      ) : null}
                      {job.can_retry ? (
                        <Button
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          disabled={isRetrying}
                          onClick={() => handleRetry(job)}
                        >
                          {isRetrying ? "Retrying..." : "Retry"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {error ? <div className="text-sm text-red-400">{error}</div> : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
