"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { formatApiErrorMessage } from "@/lib/api";
import { humanizeAiProvider, humanizePlanLabel } from "@/lib/ai-labels";
import { transferBlob } from "@/lib/blob-transfer";
import {
  approveEntry,
  deleteEntry,
  getEntry,
  getEntrySummaryMeta,
  queueEntrySummaryJob,
  rejectEntry,
  updateEntry,
  type Entry,
  type EntrySummaryMeta,
} from "@/lib/entries";
import { getJob } from "@/lib/jobs";
import { useSession } from "@/lib/use-session";
import { coerceIntegerInput } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type EditState = {
  units_target: number;
  units_produced: number;
  manpower_present: number;
  manpower_absent: number;
  downtime_minutes: number;
  downtime_reason: string;
  materials_used: string;
  quality_issues: boolean;
  quality_details: string;
  notes: string;
};

function blankEditState(): EditState {
  return {
    units_target: 1,
    units_produced: 1,
    manpower_present: 1,
    manpower_absent: 0,
    downtime_minutes: 0,
    downtime_reason: "",
    materials_used: "",
    quality_issues: false,
    quality_details: "",
    notes: "",
  };
}

function formatDate(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapEntryToEditState(entry: Entry): EditState {
  return {
    units_target: entry.units_target,
    units_produced: entry.units_produced,
    manpower_present: entry.manpower_present,
    manpower_absent: entry.manpower_absent,
    downtime_minutes: entry.downtime_minutes,
    downtime_reason: entry.downtime_reason || "",
    materials_used: entry.materials_used || "",
    quality_issues: Boolean(entry.quality_issues),
    quality_details: entry.quality_details || "",
    notes: entry.notes || "",
  };
}

function within24Hours(createdAt?: string) {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return Date.now() - created.getTime() <= 24 * 60 * 60 * 1000;
}

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function updateIntegerEditField(
  setter: Dispatch<SetStateAction<EditState>>,
  field: keyof Pick<EditState, "units_target" | "units_produced" | "manpower_present" | "manpower_absent" | "downtime_minutes">,
  value: string,
  minValue: number,
) {
  setter((prev) => ({
    ...prev,
    [field]: coerceIntegerInput(value, minValue),
  }));
}

export default function EntryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading, error: sessionError } = useSession();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [summaryMeta, setSummaryMeta] = useState<EntrySummaryMeta | null>(null);
  const [edit, setEdit] = useState<EditState>(() => blankEditState());
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [summaryJobId, setSummaryJobId] = useState<string | null>(null);

  const entryId = Number(params?.id);

  const loadEntry = useCallback(async () => {
    if (!Number.isFinite(entryId) || entryId <= 0) {
      setError("Invalid entry ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const [entryResult, metaResult] = await Promise.allSettled([
      getEntry(entryId),
      getEntrySummaryMeta(entryId),
    ]);

    if (entryResult.status === "fulfilled") {
      setEntry(entryResult.value);
      setEdit(mapEntryToEditState(entryResult.value));
    } else {
      const reason = entryResult.reason;
      setError(reason instanceof Error ? reason.message : "Could not load entry.");
    }

    if (metaResult.status === "fulfilled") {
      setSummaryMeta(metaResult.value);
    } else {
      setSummaryMeta(null);
    }
    setLoading(false);
  }, [entryId]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadEntry().catch((err) => {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Could not load entry.");
    });
  }, [loadEntry, router, sessionLoading, user]);

  useEffect(() => {
    if (!summaryJobId) return undefined;
    const interval = window.setInterval(async () => {
      try {
        const job = await getJob(summaryJobId);
        if (job.status === "succeeded") {
          setSummaryJobId(null);
          await loadEntry();
          setStatus("Summary refreshed.");
          setBusy(false);
        } else if (job.status === "failed") {
          setSummaryJobId(null);
          setError(job.error || "Summary generation failed.");
          setBusy(false);
        } else if (job.status === "canceled") {
          setSummaryJobId(null);
          setStatus(job.message || "Summary generation was canceled.");
          setBusy(false);
        } else {
          setStatus(job.message || "AI summary is still running...");
        }
      } catch (err) {
        setSummaryJobId(null);
        setError(err instanceof Error ? err.message : "Could not track summary job.");
        setBusy(false);
      }
    }, 1500);
    return () => window.clearInterval(interval);
  }, [loadEntry, summaryJobId]);

  const canApprove = user?.role === "supervisor" || user?.role === "manager" || user?.role === "admin" || user?.role === "owner";
  const canDelete = user?.role === "manager" || user?.role === "admin" || user?.role === "owner";
  const canRegenerate = Boolean(
    user &&
      entry &&
      (user.id === entry.user_id || user.role === "manager" || user.role === "admin" || user.role === "owner"),
  );
  const canEdit = useMemo(() => {
    if (!user || !entry) return false;
    if (user.role === "accountant") return false;
    if (user.id === entry.user_id) {
      if (user.role === "operator") return entry.date === todayLocal();
      return within24Hours(entry.created_at);
    }
    return (user.role === "manager" || user.role === "admin" || user.role === "owner") && within24Hours(entry.created_at);
  }, [entry, user]);

  const performance = useMemo(() => {
    if (!entry?.units_target) return 0;
    return (entry.units_produced / entry.units_target) * 100;
  }, [entry]);

  const handleAction = async (work: () => Promise<void>) => {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await work();
    } catch (err) {
      setError(formatApiErrorMessage(err, "Request failed."));
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (kind: "pdf" | "excel") => {
    if (!entry) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/reports/${kind}/${entry.id}`, {
        credentials: "include",
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        if (contentType.includes("application/json")) {
          const payload = await response.json();
          const detail =
            typeof payload?.detail === "string"
              ? payload.detail
              : payload?.detail?.message || `Could not download ${kind.toUpperCase()}.`;
          throw new Error(String(detail));
        }
        throw new Error(`Could not download ${kind.toUpperCase()}.`);
      }
      const blob = await response.blob();
      const filename = kind === "pdf" ? `dpr-entry-${entry.id}.pdf` : `dpr-entry-${entry.id}.xlsx`;
      const result = await transferBlob(blob, filename, {
        title: `DPR entry ${entry.id}`,
        text: "Entry export ready to share or save.",
      });
      setStatus(result === "shared" ? `${kind.toUpperCase()} share sheet opened.` : `${kind.toUpperCase()} download started.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not download ${kind.toUpperCase()}.`);
    } finally {
      setBusy(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-[var(--muted)]">
        Loading entry detail...
      </main>
    );
  }

  if (!user || !entry) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Entry Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{error || sessionError || "Entry not found."}</div>
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
        <section className="flex flex-col gap-5 rounded-[1.75rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-5 shadow-2xl backdrop-blur sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Entry Detail</div>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {formatDate(entry.date)} - {entry.shift}
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Submitted by {entry.submitted_by || `User ${entry.user_id || "-"}`} - status {entry.status}
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">
                Back
              </Button>
            </Link>
            <Link href="/entry" className="w-full sm:w-auto">
              <Button variant="ghost" className="w-full sm:w-auto">
                New Entry
              </Button>
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

        <section className="grid gap-5 xl:grid-cols-[0.86fr_1.14fr] xl:items-start">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Entry Meta</div>
              <CardTitle className="text-xl">Production snapshot</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <div className="text-[var(--muted)]">Date</div>
                <div className="font-semibold">{formatDate(entry.date)}</div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Shift</div>
                <div className="font-semibold">{entry.shift}</div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Department</div>
                <div className="font-semibold">{entry.department || "-"}</div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Status</div>
                <div className="font-semibold">{entry.status}</div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Submitted By</div>
                <div className="font-semibold">{entry.submitted_by || "-"}</div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Submitted At</div>
                <div className="font-semibold">{formatDateTime(entry.created_at)}</div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Units</div>
                <div className="font-semibold">
                  {entry.units_produced} / {entry.units_target}
                </div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Performance</div>
                <div className="font-semibold">{performance.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Manpower</div>
                <div className="font-semibold">
                  {entry.manpower_present} present, {entry.manpower_absent} absent
                </div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Downtime</div>
                <div className="font-semibold">{entry.downtime_minutes} min</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">AI Summary</div>
              <CardTitle className="text-xl">Operational summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm leading-7 text-[var(--text)]">
                {entry.ai_summary || "No AI summary available for this entry yet."}
              </div>
              {summaryMeta ? (
                <div className="grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2">
                  <div>AI service: <span className="text-[var(--text)]">{humanizeAiProvider(summaryMeta.provider)}</span></div>
                  <div>Plan: <span className="text-[var(--text)]">{humanizePlanLabel(summaryMeta.plan)}</span></div>
                  <div>Estimated tokens: <span className="text-[var(--text)]">~{summaryMeta.estimated_tokens}</span></div>
                  <div>Last regenerated: <span className="text-[var(--text)]">{formatDateTime(summaryMeta.last_regenerated_at || undefined)}</span></div>
                </div>
              ) : null}
              {canRegenerate ? (
                <Button
                  className="w-full sm:w-auto"
                  onClick={() =>
                    handleAction(async () => {
                      const job = await queueEntrySummaryJob(entry.id);
                      setSummaryJobId(job.job_id);
                      setStatus("AI summary queued. You can keep working while we finish it in the background.");
                    })
                  }
                  disabled={busy || Boolean(summaryJobId) || (summaryMeta ? !summaryMeta.can_regenerate : false)}
                >
                  {summaryJobId ? "Summary Running..." : busy ? "Working..." : "Regenerate Summary"}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Notes & Quality</div>
              <CardTitle className="text-xl">Production context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="text-[var(--muted)]">Downtime Reason</div>
                <div className="mt-1 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  {entry.downtime_reason || "-"}
                </div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Materials Used</div>
                <div className="mt-1 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  {entry.materials_used || "-"}
                </div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Quality Issues</div>
                <div className="mt-1 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  {entry.quality_issues ? entry.quality_details || "Yes" : "No reported issues"}
                </div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Notes</div>
                <div className="mt-1 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  {entry.notes || "-"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Actions</div>
              <CardTitle className="text-xl">Review, edit, and export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {canApprove ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium">Approval Workflow</div>
                  <Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Optional rejection reason" />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() =>
                        handleAction(async () => {
                          const next = await approveEntry(entry.id);
                          setEntry(next);
                          setStatus("Entry approved.");
                        })
                      }
                      disabled={busy}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() =>
                        handleAction(async () => {
                          const next = await rejectEntry(entry.id, rejectReason || null);
                          setEntry(next);
                          setStatus("Entry rejected.");
                        })
                      }
                      disabled={busy}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="text-sm font-medium">Downloads</div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleDownload("pdf")} disabled={busy}>
                    Download PDF
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleDownload("excel")} disabled={busy}>
                    Download Excel
                  </Button>
                </div>
              </div>

              {canEdit ? (
                <div className="space-y-4">
                  <div className="text-sm font-medium">Edit Entry</div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm text-[var(--muted)]">Units Target</label>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={edit.units_target}
                        onChange={(event) => updateIntegerEditField(setEdit, "units_target", event.target.value, 1)}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--muted)]">Units Produced</label>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={edit.units_produced}
                        onChange={(event) => updateIntegerEditField(setEdit, "units_produced", event.target.value, 1)}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--muted)]">Manpower Present</label>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={edit.manpower_present}
                        onChange={(event) => updateIntegerEditField(setEdit, "manpower_present", event.target.value, 1)}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--muted)]">Manpower Absent</label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={edit.manpower_absent}
                        onChange={(event) => updateIntegerEditField(setEdit, "manpower_absent", event.target.value, 0)}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--muted)]">Downtime Minutes</label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={edit.downtime_minutes}
                        onChange={(event) => updateIntegerEditField(setEdit, "downtime_minutes", event.target.value, 0)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Downtime Reason</label>
                    <Input value={edit.downtime_reason} onChange={(event) => setEdit((prev) => ({ ...prev, downtime_reason: event.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Materials Used</label>
                    <Textarea rows={3} value={edit.materials_used} onChange={(event) => setEdit((prev) => ({ ...prev, materials_used: event.target.value }))} />
                  </div>
                  <div>
                    <label className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={edit.quality_issues}
                        onChange={(event) => setEdit((prev) => ({ ...prev, quality_issues: event.target.checked }))}
                      />
                      Quality issues present?
                    </label>
                  </div>
                  {edit.quality_issues ? (
                    <div>
                      <label className="text-sm text-[var(--muted)]">Quality Details</label>
                      <Textarea rows={3} value={edit.quality_details} onChange={(event) => setEdit((prev) => ({ ...prev, quality_details: event.target.value }))} />
                    </div>
                  ) : null}
                  <div>
                    <label className="text-sm text-[var(--muted)]">Notes</label>
                    <Textarea rows={4} value={edit.notes} onChange={(event) => setEdit((prev) => ({ ...prev, notes: event.target.value }))} />
                  </div>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() =>
                      handleAction(async () => {
                        const next = await updateEntry(entry.id, {
                          units_target: edit.units_target,
                          units_produced: edit.units_produced,
                          manpower_present: edit.manpower_present,
                          manpower_absent: edit.manpower_absent,
                          downtime_minutes: edit.downtime_minutes,
                          downtime_reason: edit.downtime_reason || null,
                          materials_used: edit.materials_used || null,
                          quality_issues: edit.quality_issues,
                          quality_details: edit.quality_details || null,
                          notes: edit.notes || null,
                        });
                        setEntry(next);
                        setEdit(mapEntryToEditState(next));
                        setStatus("Entry updated.");
                      })
                    }
                    disabled={busy}
                  >
                    Update Entry
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  This entry is not editable from your current role or time window.
                </div>
              )}

              {canDelete ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-red-200">Delete Entry</div>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      handleAction(async () => {
                        if (!window.confirm(`Delete entry ${entry.id}? This hides it from normal views.`)) return;
                        await deleteEntry(entry.id);
                        router.push("/dashboard");
                      })
                    }
                    disabled={busy}
                  >
                    Delete Entry
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

      </div>
    </main>
  );
}
