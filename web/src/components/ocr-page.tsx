"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, formatApiErrorMessage } from "@/lib/api";
import { canUseOcrWorkspace, validateOcrImageFile } from "@/lib/ocr-access";
import { cancelJob, retryJob } from "@/lib/jobs";
import {
  archiveOcrTemplate,
  createOcrTemplate,
  downloadOcrJob,
  getOcrJob,
  getOcrStatus,
  listOcrTemplates,
  startOcrExcelJob,
  type OcrJobPayload,
  type OcrStatus,
  type OcrTemplate,
} from "@/lib/ocr";
import { pushAppToast } from "@/lib/toast";
import { triggerBlobDownload } from "@/lib/reports";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TEMPLATE_LANGUAGES = ["eng", "auto", "eng+hin+mar"];
const TEMPLATE_HEADER_MODES = ["first", "none"];

function formatTimestamp(value?: string | number) {
  if (!value) return "-";
  const timestamp =
    typeof value === "number" ? value * 1000 : value;
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
      [
        "Low Confidence Rows",
        String((metadata.low_confidence_rows as unknown[] | undefined)?.length ?? 0),
      ],
    ];
  }
  return [
    ["Rows", String(metadata.total_rows ?? 0)],
    ["Columns", String(metadata.total_columns ?? 0)],
  ];
}

export default function OcrPage() {
  const { user, loading, error: sessionError } = useSession();
  const [runtime, setRuntime] = useState<OcrStatus | null>(null);
  const [templates, setTemplates] = useState<OcrTemplate[]>([]);
  const [templateGate, setTemplateGate] = useState("");
  const [job, setJob] = useState<OcrJobPayload | null>(null);
  const [mode, setMode] = useState<"ledger" | "table">("ledger");
  const [mock, setMock] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateColumns, setTemplateColumns] = useState(3);
  const [templateLanguage, setTemplateLanguage] = useState("eng");
  const [templateHeaderMode, setTemplateHeaderMode] = useState("first");
  const [templateColumnNames, setTemplateColumnNames] = useState("");
  const [templateKeywordJson, setTemplateKeywordJson] = useState("");
  const [templateSamples, setTemplateSamples] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const canUseOcr = useMemo(() => canUseOcrWorkspace(user?.role), [user?.role]);

  const validateImageFile = useCallback((input: File | null, fieldLabel: string) => {
    return validateOcrImageFile(input, fieldLabel, { required: true });
  }, []);

  const loadRuntime = useCallback(async () => {
    const [statusResult, templatesResult] = await Promise.allSettled([
      getOcrStatus(),
      listOcrTemplates(),
    ]);
    if (statusResult.status === "fulfilled") {
      setRuntime(statusResult.value);
    }
    if (templatesResult.status === "fulfilled") {
      setTemplates(templatesResult.value);
      setTemplateGate("");
    } else if (
      templatesResult.reason instanceof ApiError &&
      templatesResult.reason.status === 403
    ) {
      setTemplates([]);
      setTemplateGate(templatesResult.reason.message);
    } else if (templatesResult.reason instanceof Error) {
      setTemplateGate(templatesResult.reason.message);
    }
  }, []);

  useEffect(() => {
    if (!canUseOcr) return;
    loadRuntime().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load OCR runtime.");
    });
  }, [canUseOcr, loadRuntime]);

  useEffect(() => {
    if (!job?.job_id) return;
    if (!["queued", "running", "canceling"].includes(job.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const nextJob = await getOcrJob(job.job_id);
        setJob(nextJob);
        if (nextJob.status === "canceled") {
          setBusy(false);
          setStatus("OCR job cancelled.");
        } else if (nextJob.status === "failed") {
          setBusy(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not refresh OCR job.");
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [job]);

  const handleStartJob = async () => {
    const selectedFile = file;
    const preflightError = validateImageFile(selectedFile, "Image file");
    if (preflightError) {
      setError(preflightError);
      return;
    }
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const started = await startOcrExcelJob({ kind: mode, file: selectedFile as File, mock });
      setJob(started);
      setStatus(
        mode === "ledger"
          ? "OCR job queued. We will keep polling until the Excel file is ready."
          : "Table scan job queued. We will keep polling until the Excel file is ready.",
      );
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not start OCR job."));
    } finally {
      setBusy(false);
    }
  };

  const handleCancelCurrentJob = async () => {
    if (!job?.job_id) return;
    setBusy(true);
    setError("");
    try {
      const cancelled = await cancelJob(job.job_id);
      setJob((cancelled as OcrJobPayload));
      setStatus(cancelled.status === "canceled" ? "OCR job cancelled." : "OCR cancellation requested.");
      pushAppToast({
        title: "OCR job cancelled",
        description: "You can retry it whenever you are ready.",
        tone: "info",
      });
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not cancel OCR job."));
    } finally {
      setBusy(false);
    }
  };

  const handleRetryCurrentJob = async () => {
    if (!job?.job_id) return;
    setBusy(true);
    setError("");
    try {
      const retried = await retryJob(job.job_id);
      setJob(retried as OcrJobPayload);
      setStatus("OCR job retried. We are watching the fresh run now.");
      pushAppToast({
        title: "OCR job retried",
        description: "OCR queued.",
        tone: "success",
      });
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not retry OCR job."));
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (!job?.job_id) return;
    setDownloadBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await downloadOcrJob(job.job_id);
      triggerBlobDownload(result.blob, result.filename);
      setStatus(`Download started: ${result.filename}`);
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not download OCR result."));
    } finally {
      setDownloadBusy(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      setError("Template name is required.");
      return;
    }
    if (!templateSamples.length) {
      setError("Add at least one sample image for the template.");
      return;
    }
    for (const sample of templateSamples) {
      const sampleError = validateImageFile(sample, "Template sample");
      if (sampleError) {
        setError(sampleError);
        return;
      }
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const columnNames = templateColumnNames
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const created = await createOcrTemplate({
        name: templateName.trim(),
        columns: templateColumns,
        headerMode: templateHeaderMode,
        language: templateLanguage,
        columnNames: columnNames.length ? columnNames : undefined,
        columnKeywords: templateKeywordJson.trim()
          ? JSON.parse(templateKeywordJson)
          : undefined,
        samples: templateSamples,
      });
      setTemplates((current) => [created.template, ...current]);
      setTemplateName("");
      setTemplateColumns(3);
      setTemplateLanguage("eng");
      setTemplateHeaderMode("first");
      setTemplateColumnNames("");
      setTemplateKeywordJson("");
      setTemplateSamples([]);
      setStatus("Template created.");
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Column keyword JSON is invalid.");
      } else {
        setError(formatApiErrorMessage(err, "Could not create OCR template."));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleArchiveTemplate = async (templateId: number) => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await archiveOcrTemplate(templateId);
      setTemplates((current) => current.filter((template) => template.id !== templateId));
      setStatus("Template archived.");
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not archive OCR template."));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading OCR workspace...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>OCR Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Login required."}</div>
            <Link href="/access">
              <Button>Open Login</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canUseOcr) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>OCR Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">
              OCR tools are available to supervisors, managers, admins, and owners.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">Back to Dashboard</Button>
              </Link>
              <Link href="/reports" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">Open Reports</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const metadataRows = formatMetadata(job);

  return (
    <main className="min-h-screen px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
        <section className="flex flex-col gap-5 rounded-[1.75rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-5 shadow-2xl backdrop-blur sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
              OCR
            </div>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Logbook OCR and template manager</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Run the async OCR queue for ledger and table exports, monitor job state, and manage OCR templates for higher plans.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:flex-wrap lg:justify-end">
            <Link href="/ocr/scan" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">Scan a Document</Button>
            </Link>
            <Link href="/ocr/verify" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">Open Verification</Button>
            </Link>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">Dashboard</Button>
            </Link>
            <Link href="/email-summary" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">Email Summary</Button>
            </Link>
          </div>
        </section>

        {status ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {status}
          </div>
        ) : null}
        {error || sessionError ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error || sessionError}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">OCR Runtime</div>
              <CardTitle>{runtime?.installed ? "Ready" : "Not Installed"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {runtime?.installed
                ? `Tesseract ${runtime.version || ""}`.trim()
                : runtime?.message || "Tesseract status unavailable."}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Available Languages</div>
              <CardTitle>{runtime?.languages?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {runtime?.languages?.length
                ? runtime.languages.join(", ")
                : "Language list is not available right now."}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Template Access</div>
              <CardTitle>{templateGate ? "Plan gated" : `${templates.length} templates`}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {templateGate || "Factory, Business, Enterprise, or any OCR pack can keep reusable OCR layouts here."}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_1fr] xl:items-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Start OCR Job</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-[var(--muted)]">OCR Mode</label>
                <Select value={mode} onChange={(event) => setMode(event.target.value as "ledger" | "table") }>
                  <option value="ledger">Ledger to Excel</option>
                  <option value="table">Table Scan to Excel</option>
                </Select>
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Image File</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
              </div>
              {mode === "ledger" ? (
                <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={mock}
                    onChange={(event) => setMock(event.target.checked)}
                  />
                  Use mock data instead of live AI OCR
                </label>
              ) : null}
              <Button className="w-full sm:w-auto" onClick={handleStartJob} disabled={busy || !file}>
                {busy ? "Queuing..." : "Run OCR Queue"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Job Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {job ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
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
                  <div className="grid gap-3 sm:grid-cols-2">
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
                    <div className="grid gap-3 sm:grid-cols-2">
                      {metadataRows.map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4"
                        >
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    {job.status === "succeeded" ? (
                      <Button className="w-full sm:w-auto" onClick={handleDownload} disabled={downloadBusy}>
                        {downloadBusy ? "Preparing download..." : "Download Excel Result"}
                      </Button>
                    ) : null}
                    {["queued", "running", "canceling"].includes(job.status) ? (
                      <Button className="w-full sm:w-auto" variant="outline" onClick={handleCancelCurrentJob} disabled={busy}>
                        {busy || job.status === "canceling" ? "Stopping..." : "Cancel Job"}
                      </Button>
                    ) : null}
                    {["failed", "canceled"].includes(job.status) ? (
                      <Button className="w-full sm:w-auto" variant="outline" onClick={handleRetryCurrentJob} disabled={busy}>
                        {busy ? "Retrying..." : "Retry Job"}
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-[var(--muted)]">
                  Start an OCR job and we will show live queue status here.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Template Manager</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {templateGate ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  {templateGate}
                </div>
              ) : templates.length ? (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-lg font-semibold">{template.name}</div>
                          <div className="mt-1 text-sm text-[var(--muted)]">
                            {template.columns} columns, {template.language}, header mode {template.header_mode}
                          </div>
                          {template.column_names?.length ? (
                            <div className="mt-2 text-xs text-[var(--muted)]">
                              Columns: {template.column_names.join(", ")}
                            </div>
                          ) : null}
                        </div>
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => handleArchiveTemplate(template.id)}
                          disabled={busy}
                        >
                          Archive
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  No OCR templates yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Create Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-[var(--muted)]">Template Name</label>
                <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-[var(--muted)]">Columns</label>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={templateColumns}
                    onChange={(event) => setTemplateColumns(Math.max(1, Number(event.target.value) || 1))}
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Language</label>
                  <Select value={templateLanguage} onChange={(event) => setTemplateLanguage(event.target.value)}>
                    {TEMPLATE_LANGUAGES.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Header Mode</label>
                <Select value={templateHeaderMode} onChange={(event) => setTemplateHeaderMode(event.target.value)}>
                  {TEMPLATE_HEADER_MODES.map((headerMode) => (
                    <option key={headerMode} value={headerMode}>
                      {headerMode}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Column Names (comma separated)</label>
                <Input
                  value={templateColumnNames}
                  onChange={(event) => setTemplateColumnNames(event.target.value)}
                  placeholder="Date, Machine, Shift, Qty, Remarks"
                />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Keyword Hints JSON (optional)</label>
                <Textarea
                  value={templateKeywordJson}
                  onChange={(event) => setTemplateKeywordJson(event.target.value)}
                  rows={4}
                  placeholder='[["date","day"],["qty","quantity"],["remarks","notes"]]'
                />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Sample Images</label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setTemplateSamples(Array.from(event.target.files || []))}
                />
              </div>
              <Button className="w-full sm:w-auto" onClick={handleCreateTemplate} disabled={busy || !!templateGate}>
                {busy ? "Saving..." : "Create OCR Template"}
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
