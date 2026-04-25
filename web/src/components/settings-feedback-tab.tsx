"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { transferBlob } from "@/lib/blob-transfer";
import { formatApiErrorMessage } from "@/lib/api";
import {
  downloadFeedbackExport,
  listFeedbackAdmin,
  updateFeedbackRecord,
  type FeedbackAdminItem,
  type FeedbackSort,
  type FeedbackStatus,
  type FeedbackType,
} from "@/lib/feedback";
import { pushAppToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SafeText } from "@/components/ui/safe-text";
import { cn } from "@/lib/utils";

type Props = {
  active: boolean;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatTypeLabel(value: FeedbackType) {
  switch (value) {
    case "alert_problem":
      return "Alert problem";
    case "suggestion":
      return "Suggestion";
    case "bug":
      return "Bug";
    default:
      return "Issue";
  }
}

function formatStatusLabel(value: FeedbackStatus) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function badgeTone(status: FeedbackStatus) {
  if (status === "resolved") {
    return "border-emerald-400/30 bg-emerald-500/12 text-emerald-100";
  }
  if (status === "triaged") {
    return "border-amber-400/30 bg-amber-500/12 text-amber-100";
  }
  return "border-sky-400/30 bg-sky-500/12 text-sky-100";
}

function formatSourceLabel(value: FeedbackAdminItem["source"]) {
  switch (value) {
    case "error_prompt":
      return "Error prompt";
    case "micro":
      return "Micro";
    default:
      return "Floating";
  }
}

export default function SettingsFeedbackTab({ active }: Props) {
  const [rows, setRows] = useState<FeedbackAdminItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("open");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [sortFilter, setSortFilter] = useState<FeedbackSort>("recency");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [exporting, setExporting] = useState(false);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await listFeedbackAdmin({
        status: statusFilter,
        type: typeFilter,
        sort: sortFilter,
        limit: 50,
      });
      setRows(payload.items);
      setLoaded(true);
    } catch (loadError) {
      setError(formatApiErrorMessage(loadError, "Could not load feedback."));
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [sortFilter, statusFilter, typeFilter]);

  useEffect(() => {
    if (!active) return;
    void loadFeedback();
  }, [active, loadFeedback]);

  const itemCountLabel = useMemo(() => {
    if (loading && !loaded) return "Loading feedback...";
    if (!rows.length) return "No feedback in this filter.";
    return `${rows.length} feedback item(s)`;
  }, [loaded, loading, rows.length]);

  const recurringGroups = useMemo(() => {
    const seen = new Set<string>();
    return rows
      .filter((row) => {
        if (seen.has(row.group_key)) return false;
        seen.add(row.group_key);
        return row.group_occurrences > 1;
      })
      .sort((left, right) => right.group_occurrences - left.group_occurrences)
      .slice(0, 4);
  }, [rows]);

  const handleStatusUpdate = async (row: FeedbackAdminItem, nextStatus: FeedbackStatus) => {
    setPendingId(row.id);
    try {
      const updated = await updateFeedbackRecord(row.id, {
        status: nextStatus,
        resolution_note: notes[row.id] ?? row.resolution_note ?? null,
      });
      setRows((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      pushAppToast({
        title:
          nextStatus === "resolved"
            ? "Feedback resolved"
            : nextStatus === "triaged"
              ? "Feedback triaged"
              : "Feedback reopened",
        description:
          nextStatus === "resolved"
            ? "The item moved out of the open queue."
            : nextStatus === "triaged"
              ? "The item stays visible with triage context."
              : "The item is back in the active queue.",
        tone: "success",
      });
    } catch (updateError) {
      pushAppToast({
        title: "Feedback update failed",
        description: formatApiErrorMessage(updateError, "Could not update feedback."),
        tone: "error",
      });
    } finally {
      setPendingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const file = await downloadFeedbackExport({
        status: statusFilter,
        type: typeFilter,
        sort: sortFilter,
      });
      await transferBlob(file.blob, file.filename, {
        title: "Feedback export",
        text: "Feedback CSV is ready to share or save.",
      });
    } catch (exportError) {
      pushAppToast({
        title: "Export failed",
        description: formatApiErrorMessage(exportError, "Could not export feedback."),
        tone: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">Feedback Queue</CardTitle>
            <div className="mt-2 text-sm text-[var(--muted)]">
              Review issues, suggestions, wrong-alert reports, and error-triggered reports with automatic app context.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport} disabled={loading || exporting}>
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button variant="outline" onClick={() => void loadFeedback()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[12rem_12rem_12rem_1fr]">
            <div>
              <label className="text-sm text-[var(--muted)]">Status</label>
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FeedbackStatus | "all")}>
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="triaged">Triaged</option>
                <option value="resolved">Resolved</option>
              </Select>
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Type</label>
              <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as FeedbackType | "all")}>
                <option value="all">All</option>
                <option value="issue">Issue</option>
                <option value="bug">Bug</option>
                <option value="suggestion">Suggestion</option>
                <option value="alert_problem">Alert problem</option>
              </Select>
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Sort</label>
              <Select value={sortFilter} onChange={(event) => setSortFilter(event.target.value as FeedbackSort)}>
                <option value="recency">Recency</option>
                <option value="frequency">Frequency</option>
              </Select>
            </div>
            <div className="flex items-end text-sm text-[var(--muted)]">{itemCountLabel}</div>
          </div>

          {recurringGroups.length ? (
            <div className="grid gap-3 xl:grid-cols-4">
              {recurringGroups.map((row) => (
                <div key={row.group_key} className="rounded-2xl border border-[rgba(62,166,255,0.22)] bg-[rgba(20,24,36,0.86)] p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                    Recurring issue
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">{row.group_occurrences} reports</div>
                  <SafeText as="div" className="mt-2 text-sm text-[var(--muted)]">
                    {row.message_original}
                  </SafeText>
                  <div className="mt-2 text-xs text-[var(--muted)]">
                    Latest {formatDateTime(row.latest_similar_at)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {loading && !loaded ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : rows.length ? (
            <div className="space-y-4">
              {rows.map((row) => (
                <div key={row.id} className="rounded-[1.75rem] border border-[var(--border)] bg-[rgba(12,16,24,0.76)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                          {formatTypeLabel(row.type)}
                        </span>
                        <span className={cn("rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", badgeTone(row.status))}>
                          {formatStatusLabel(row.status)}
                        </span>
                        <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                          {formatSourceLabel(row.source)}
                        </span>
                        {row.rating ? (
                          <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                            {row.rating === "up" ? "Helpful" : "Not helpful"}
                          </span>
                        ) : null}
                        {row.mood ? (
                          <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                            {row.mood}
                          </span>
                        ) : null}
                        {row.group_occurrences > 1 ? (
                          <span className="rounded-full border border-[rgba(62,166,255,0.26)] bg-[rgba(62,166,255,0.12)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-100">
                            {row.group_occurrences} similar
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 text-sm font-semibold text-white">
                        <SafeText>{row.user_name}</SafeText> · {row.user_role}
                        {row.factory_name ? ` · ${row.factory_name}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        {formatDateTime(row.created_at)}
                        {row.detected_language ? ` · language ${row.detected_language}` : ""}
                        {row.latest_similar_at && row.group_occurrences > 1 ? ` · latest similar ${formatDateTime(row.latest_similar_at)}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <SafeText as="div" className="text-sm text-[var(--text)]">
                      {row.message_original}
                    </SafeText>
                    {row.message_translated && row.message_translated !== row.message_original ? (
                      <SafeText as="div" className="mt-3 text-sm text-[var(--muted)]">
                        Translated: {row.message_translated}
                      </SafeText>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                      <div className="font-semibold text-white">Context</div>
                      <div className="mt-2">Route: {String(row.context?.route || "-")}</div>
                      <div className="mt-1">Page: {String(row.context?.page_title || "-")}</div>
                      <div className="mt-1">Last action: {String(row.context?.last_action || "-")}</div>
                      <div className="mt-1">Time: {String(row.context?.timestamp_local || row.context?.timestamp_utc || "-")}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                      <div className="font-semibold text-white">Environment</div>
                      <div className="mt-2">Factory: {String(row.context?.active_factory_name || row.factory_name || "-")}</div>
                      <div className="mt-1">Language: {String(row.context?.app_language || row.detected_language || "-")}</div>
                      <div className="mt-1">Timezone: {String(row.context?.timezone || "-")}</div>
                      <div className="mt-1">Recent error: {String((row.context?.recent_error as { message?: string } | null)?.message || "-")}</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="text-sm text-[var(--muted)]">Resolution note</label>
                    <Textarea
                      rows={3}
                      value={notes[row.id] ?? row.resolution_note ?? ""}
                      onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                      placeholder="Optional note for the support or product team."
                    />
                  </div>

                  {row.resolved_at ? (
                    <div className="mt-3 text-xs text-[var(--muted)]">
                      Resolved {formatDateTime(row.resolved_at)}
                      {row.resolved_by_name ? ` by ${row.resolved_by_name}` : ""}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    {row.status !== "open" ? (
                      <Button
                        variant="outline"
                        onClick={() => void handleStatusUpdate(row, "open")}
                        disabled={pendingId === row.id}
                      >
                        {pendingId === row.id ? "Updating..." : "Reopen"}
                      </Button>
                    ) : null}
                    {row.status !== "triaged" ? (
                      <Button
                        variant="outline"
                        onClick={() => void handleStatusUpdate(row, "triaged")}
                        disabled={pendingId === row.id}
                      >
                        {pendingId === row.id ? "Updating..." : "Mark triaged"}
                      </Button>
                    ) : null}
                    {row.status !== "resolved" ? (
                      <Button onClick={() => void handleStatusUpdate(row, "resolved")} disabled={pendingId === row.id}>
                        {pendingId === row.id ? "Updating..." : "Mark resolved"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-[var(--border-strong)] bg-[rgba(11,16,26,0.6)] px-6 py-10 text-center">
              <div className="text-lg font-semibold text-white">No feedback yet.</div>
              <div className="mt-2 text-sm text-[var(--muted)]">
                When operators or managers send feedback from the floating help button, quick prompt, or error prompt, it will appear here with app context.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
