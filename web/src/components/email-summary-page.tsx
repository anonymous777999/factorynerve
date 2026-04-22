"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import {
  buildComposeLinks,
  generateEmailSummary,
  getEmailSummary,
  type EmailSummarySnapshot,
} from "@/lib/email-summary";
import { getOcrVerificationSummary, type OcrVerificationSummary } from "@/lib/ocr";
import { getSteelOverview, type SteelOverview } from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function monthStartValue() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(first.getTime() - offset).toISOString().slice(0, 10);
}

function formatCurrency(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "Restricted";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function EmailSummaryPage() {
  const { user, loading, error: sessionError, activeFactory } = useSession();
  const [startDate, setStartDate] = useState(daysAgo(7));
  const [endDate, setEndDate] = useState(todayValue());
  const [summary, setSummary] = useState<EmailSummarySnapshot | null>(null);
  const [ocrSummary, setOcrSummary] = useState<OcrVerificationSummary | null>(null);
  const [steelOverview, setSteelOverview] = useState<SteelOverview | null>(null);
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [initializedRangeKey, setInitializedRangeKey] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [ocrWarning, setOcrWarning] = useState("");
  const [steelWarning, setSteelWarning] = useState("");

  const canUseEmail = useMemo(() => user?.role !== "operator" && user?.role !== "attendance", [user]);
  const steelMode = (activeFactory?.industry_type || "").toLowerCase() === "steel";

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError("");
    setStatus("");
    setOcrWarning("");
    setSteelWarning("");
    try {
      const [summaryResult, ocrResult, steelResult] = await Promise.allSettled([
        getEmailSummary(startDate, endDate),
        getOcrVerificationSummary(),
        steelMode ? getSteelOverview() : Promise.resolve(null),
      ]);

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        throw summaryResult.reason;
      }

      if (ocrResult.status === "fulfilled") {
        setOcrSummary(ocrResult.value);
      } else {
        setOcrSummary(null);
        const reason = ocrResult.reason;
        setOcrWarning(
          reason instanceof Error
            ? `OCR trust summary is unavailable right now: ${reason.message}`
            : "OCR trust summary is unavailable right now.",
        );
      }

      if (steelResult.status === "fulfilled") {
        setSteelOverview(steelResult.value);
      } else {
        setSteelOverview(null);
        const reason = steelResult.reason;
        setSteelWarning(
          reason instanceof Error
            ? `Owner steel risk summary is unavailable right now: ${reason.message}`
            : "Owner steel risk summary is unavailable right now.",
        );
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not load email summary.");
      }
    } finally {
      setLoadingSummary(false);
    }
  }, [endDate, startDate, steelMode]);

  useEffect(() => {
    if (!canUseEmail) return;
    loadSummary().catch(() => undefined);
  }, [canUseEmail, loadSummary]);

  useEffect(() => {
    if (!summary) return;
    const rangeKey = `${summary.range.start_date}:${summary.range.end_date}`;
    if (rangeKey === initializedRangeKey) return;
    setRecipientsRaw(summary.suggested_recipients.join(", "));
    setSubject(summary.subject);
    setBody("");
    setInitializedRangeKey(rangeKey);
  }, [initializedRangeKey, summary]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    setStatus("");
    try {
      const draft = await generateEmailSummary(startDate, endDate);
      setSubject(draft.subject);
      setBody(draft.body);
      setStatus(`AI draft generated with ${draft.provider}.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not generate AI email.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setStatus("Email body copied to clipboard.");
      setError("");
    } catch {
      setError("Clipboard access is not available in this browser.");
    }
  };

  const recipients = recipientsRaw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const composeLinks = buildComposeLinks(recipients, subject, body);
  const draftReady = Boolean(recipients.length && subject.trim() && body.trim());
  const ownerRiskLines = useMemo(() => {
    if (!steelOverview) return [];
    const highRiskBatchCount =
      Number(steelOverview.anomaly_summary.high_batches || 0) +
      Number(steelOverview.anomaly_summary.critical_batches || 0);
    const lines = [
      `Leakage under watch: ${steelOverview.financial_access ? formatCurrency(steelOverview.anomaly_summary.total_estimated_leakage_value_inr) : "financial leakage is restricted for this role"}.`,
      `Dispatch exposure waiting to convert: ${steelOverview.financial_access ? formatCurrency(steelOverview.profit_summary?.outstanding_invoice_amount_inr) : "financial exposure is restricted"} across ${Number(steelOverview.profit_summary?.outstanding_invoice_weight_kg || 0).toLocaleString("en-IN")} KG.`,
      `Stock trust: ${Number(steelOverview.confidence_counts.red || 0)} red and ${Number(steelOverview.confidence_counts.yellow || 0)} watch stock positions currently need review.`,
      `Repeated risk: ${highRiskBatchCount} high-risk batch signal${highRiskBatchCount === 1 ? "" : "s"} with ${steelOverview.anomaly_summary.highest_risk_operator?.name || "no top operator yet"} as the strongest responsibility signal.`,
    ];
    if (steelOverview.anomaly_summary.highest_loss_day?.date) {
      lines.push(`Highest-loss day in this window: ${steelOverview.anomaly_summary.highest_loss_day.date}.`);
    }
    return lines;
  }, [steelOverview]);
  const bodyHasOwnerRisk = body.includes("Owner Risk Watch");
  const sendReadinessCards = useMemo(
    () => [
      {
        label: "Recipients",
        value: `${recipients.length}`,
        tone:
          recipients.length > 0
            ? "border-emerald-400/25 bg-[rgba(34,197,94,0.08)] text-emerald-50"
            : "border-amber-400/25 bg-[rgba(245,158,11,0.08)] text-amber-50",
        detail:
          recipients.length > 0
            ? "Delivery targets are configured."
            : "Add recipients before sending the update out.",
      },
      {
        label: "Trusted OCR",
        value: `${ocrSummary?.trusted_documents ?? 0} docs`,
        tone:
          (ocrSummary?.pending_documents ?? 0) === 0
            ? "border-cyan-400/25 bg-[rgba(34,211,238,0.08)] text-cyan-50"
            : "border-amber-400/25 bg-[rgba(245,158,11,0.08)] text-amber-50",
        detail:
          (ocrSummary?.pending_documents ?? 0) === 0
            ? "Approved OCR is clear for this range."
            : `${ocrSummary?.pending_documents ?? 0} OCR document${(ocrSummary?.pending_documents ?? 0) === 1 ? "" : "s"} still need review.`,
      },
      {
        label: "Risk Framing",
        value: bodyHasOwnerRisk ? "Attached" : "Optional",
        tone:
          bodyHasOwnerRisk
            ? "border-red-400/25 bg-[rgba(239,68,68,0.08)] text-red-50"
            : "border-white/10 bg-[rgba(255,255,255,0.03)] text-white",
        detail:
          ownerRiskLines.length > 0
            ? "Owner risk lines are available for this window."
            : "No steel risk block is available for this factory or date range.",
      },
      {
        label: "Draft Status",
        value: draftReady ? "Ready" : "Needs draft",
        tone:
          draftReady
            ? "border-emerald-400/25 bg-[rgba(34,197,94,0.08)] text-emerald-50"
            : "border-white/10 bg-[rgba(255,255,255,0.03)] text-white",
        detail:
          draftReady
            ? "Subject, recipients, and body are all filled."
            : "Generate or write the body before opening Gmail or Outlook.",
      },
    ],
    [bodyHasOwnerRisk, draftReady, ocrSummary?.pending_documents, ocrSummary?.trusted_documents, ownerRiskLines.length, recipients.length],
  );

  const handleAppendOwnerRisk = useCallback(() => {
    if (!ownerRiskLines.length) return;
    const ownerBlock = `Owner Risk Watch\n${ownerRiskLines.map((line) => `- ${line}`).join("\n")}`;
    setBody((current) => (current.trim() ? `${current.trim()}\n\n${ownerBlock}` : ownerBlock));
    setStatus("Owner risk lines added to the email body.");
    setError("");
  }, [ownerRiskLines]);

  const handleQuickRange = useCallback((mode: "today" | "week" | "month") => {
    if (mode === "today") {
      setStartDate(todayValue());
      setEndDate(todayValue());
      return;
    }
    if (mode === "month") {
      setStartDate(monthStartValue());
      setEndDate(todayValue());
      return;
    }
    setStartDate(daysAgo(7));
    setEndDate(todayValue());
  }, []);

  const handleUseSuggestedRecipients = useCallback(() => {
    if (!summary?.suggested_recipients?.length) return;
    setRecipientsRaw(summary.suggested_recipients.join(", "));
    setStatus("Suggested recipients loaded.");
    setError("");
  }, [summary]);

  const handleResetDraft = useCallback(() => {
    if (!summary) return;
    setRecipientsRaw(summary.suggested_recipients.join(", "));
    setSubject(summary.subject);
    setBody("");
    setStatus("Draft reset to the summary defaults.");
    setError("");
  }, [summary]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading email summary...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Email Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please sign in to continue."}</div>
            {/* AUDIT: FLOW_BROKEN - Signed-out recovery should return to the current auth entry route instead of an older legacy path. */}
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canUseEmail) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Email Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">
              Email summaries are available to supervisors, accountants, managers, admins, and owners.
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard">
                <Button>Dashboard</Button>
              </Link>
              <Link href="/plans">
                <Button variant="outline">View Plans</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* AUDIT: FLOW_BROKEN - Added an explicit three-step frame so the page reads as a send workflow instead of a toolbox. */}
        <section className="grid gap-4 md:grid-cols-3">
          {[
            { step: "1", title: "Pick range", detail: "Choose the window and refresh the snapshot." },
            { step: "2", title: "Review trust", detail: "Check OCR, risk, and operating signals before drafting." },
            { step: "3", title: "Open mail", detail: "Generate the message, then finish in your own mail client." },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] px-5 py-4 shadow-[var(--shadow-soft)]"
            >
              <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[var(--accent)]">Step {item.step}</div>
              <div className="mt-2 font-semibold text-[var(--text)]">{item.title}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{item.detail}</div>
            </div>
          ))}
        </section>

        <section className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
              Email Summary
            </div>
            <h1 className="mt-2 text-3xl font-semibold">Compose trusted factory updates fast</h1>
            {/* AUDIT: TEXT_NOISE - The hero copy now states the promise once and lets the workflow cards explain the rest. */}
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Pull the range, check trust, and open a leadership-ready draft in your own mail client.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-cyan-400/25 bg-[rgba(34,211,238,0.08)] px-3 py-1 text-cyan-100">
                Trust before send
              </span>
              <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted)]">
                Finish in mail
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* AUDIT: BUTTON_CLUTTER - Kept the most likely companion route visible and moved lower-priority jumps into a compact tray. */}
            <Link href="/reports">
              <Button>Reports</Button>
            </Link>
            <details className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--muted)]">
              <summary className="cursor-pointer list-none">More</summary>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/dashboard">
                  <Button variant="outline">Dashboard</Button>
                </Link>
                <Link href="/plans">
                  <Button variant="outline">Plans</Button>
                </Link>
              </div>
            </details>
          </div>
        </section>

        <Card>
          <CardHeader>
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Step 1</div>
            <CardTitle className="text-xl">Pick range</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {/* AUDIT: TEXT_NOISE - Shortened quick-range labels so the controls scan as presets instead of mini explanations. */}
              <Button variant="outline" onClick={() => handleQuickRange("today")}>Today</Button>
              <Button variant="outline" onClick={() => handleQuickRange("week")}>Last 7d</Button>
              <Button variant="outline" onClick={() => handleQuickRange("month")}>This Month</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <div>
                <label className="text-sm text-[var(--muted)]">Start Date</label>
                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div>
              <label className="text-sm text-[var(--muted)]">End Date</label>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
              <div className="flex items-end">
                <Button onClick={() => loadSummary()} disabled={loadingSummary}>
                  {loadingSummary ? "Loading..." : "Refresh"}
                </Button>
              </div>
            </div>
            {/* AUDIT: FLOW_BROKEN - Replaced the long recommendation sentence with one short next-step cue. */}
            <div className="text-xs text-[var(--muted)]">Refresh the window, then review trust before drafting.</div>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Step 2</div>
            <h2 className="mt-2 text-2xl font-semibold">Review trust</h2>
          </div>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sendReadinessCards.map((item) => (
            <div
              key={item.label}
              className={`rounded-2xl border p-4 ${item.tone}`}
            >
              <div className="text-xs uppercase tracking-[0.2em] opacity-80">{item.label}</div>
              <div className="mt-2 text-2xl font-semibold">{item.value}</div>
              <div className="mt-2 text-sm opacity-85">{item.detail}</div>
            </div>
          ))}
        </section>
          {/* AUDIT: DENSITY_OVERLOAD - Range context metrics remain available, but they no longer compete with the send-readiness scan on first glance. */}
          <details className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-soft)]">
            <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">
              Window context
            </summary>
            <div className={`mt-4 grid gap-4 md:grid-cols-2 ${steelOverview ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
              <Card>
                <CardHeader>
                  <div className="text-sm text-[var(--muted)]">Plan</div>
                  <CardTitle>{summary?.plan || "-"}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-[var(--muted)]">
                  Email AI requires {summary?.min_plan || "growth"} or higher.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="text-sm text-[var(--muted)]">Provider</div>
                  <CardTitle>{summary?.provider || "-"}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-[var(--muted)]">
                  Estimated tokens: {summary?.estimated_tokens || 0}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="text-sm text-[var(--muted)]">Top Performer</div>
                  <CardTitle>{summary?.top_performer?.name || "-"}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-[var(--muted)]">
                  {summary?.top_performer
                    ? `${summary.top_performer.production_percent.toFixed(1)}% production`
                    : "No data for this range."}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="text-sm text-[var(--muted)]">Most Downtime</div>
                  <CardTitle>{summary?.most_downtime?.name || "-"}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-[var(--muted)]">
                  {summary?.most_downtime
                    ? `${summary.most_downtime.downtime_minutes} min`
                    : "No downtime spikes found."}
                </CardContent>
              </Card>
              {steelOverview ? (
                <Card>
                  <CardHeader>
                    <div className="text-sm text-[var(--muted)]">Money At Risk</div>
                    <CardTitle>
                      {steelOverview.financial_access
                        ? formatCurrency(steelOverview.anomaly_summary.total_estimated_leakage_value_inr)
                        : "Restricted"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-[var(--muted)]">
                    {Number(steelOverview.anomaly_summary.high_batches || 0) + Number(steelOverview.anomaly_summary.critical_batches || 0)} high-risk steel anomaly signals are active.
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </details>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Summary Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="text-sm text-[var(--muted)]">Units</div>
                      <div className="mt-1 text-xl font-semibold">
                        {summary.totals.total_units} / {summary.totals.total_target}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="text-sm text-[var(--muted)]">Average Performance</div>
                      <div className="mt-1 text-xl font-semibold">
                        {summary.totals.average_performance.toFixed(1)}%
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="text-sm text-[var(--muted)]">Total Downtime</div>
                      <div className="mt-1 text-xl font-semibold">
                        {summary.totals.total_downtime} min
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="text-sm text-[var(--muted)]">Manpower</div>
                      <div className="mt-1 text-xl font-semibold">
                        {summary.totals.manpower_present} present / {summary.totals.manpower_absent} absent
                      </div>
                    </div>
                    <div className="rounded-2xl border border-cyan-400/30 bg-[rgba(34,211,238,0.08)] p-4 md:col-span-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm text-cyan-100/80">Verified OCR Feed</div>
                          <div className="mt-1 text-xl font-semibold text-cyan-50">
                            {ocrSummary?.trusted_documents ?? 0} trusted docs / {ocrSummary?.pending_documents ?? 0} pending
                          </div>
                        </div>
                        <Link href="/ocr/verify">
                          <Button variant="outline">Review OCR</Button>
                        </Link>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Trusted rows</div>
                          <div className="mt-1 text-lg font-semibold text-white">{ocrSummary?.trusted_rows ?? 0}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Untrusted docs</div>
                          <div className="mt-1 text-lg font-semibold text-white">{ocrSummary?.untrusted_documents ?? 0}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Last trusted</div>
                          <div className="mt-1 text-sm font-semibold text-white">
                            {ocrSummary?.last_trusted_at
                              ? new Date(ocrSummary.last_trusted_at).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-cyan-50/85">Only approved OCR should feed leadership updates.</div>
                    </div>
                    {steelOverview ? (
                      <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.08)] p-4 md:col-span-2">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm text-red-100/80">Owner Risk Watch</div>
                            <div className="mt-1 text-xl font-semibold text-red-50">
                              {steelOverview.financial_access
                                ? formatCurrency(steelOverview.anomaly_summary.total_estimated_leakage_value_inr)
                                : "Restricted financial view"}
                            </div>
                            <div className="mt-2 text-sm text-red-50/85">
                              Dispatch exposure:{" "}
                              {steelOverview.financial_access
                                ? formatCurrency(steelOverview.profit_summary?.outstanding_invoice_amount_inr)
                                : "Restricted"}{" "}
                              | Stock trust: {Number(steelOverview.confidence_counts.red || 0)} red / {Number(steelOverview.confidence_counts.yellow || 0)} watch
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link href="/premium/dashboard">
                              <Button variant="outline">Owner Desk</Button>
                            </Link>
                            <Link href="/steel/charts">
                              <Button variant="ghost">Steel Charts</Button>
                            </Link>
                          </div>
                        </div>
                        {/* AUDIT: DENSITY_OVERLOAD - Owner risk lines stay available, but the guidance copy is shortened so the signals carry the weight. */}
                        <div className="mt-4 space-y-2">
                          {ownerRiskLines.map((line) => (
                            <div key={line} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-red-50/90">
                              {line}
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 text-sm text-red-50/80">Use this block when the owner wants the week&apos;s biggest risk in one glance.</div>
                      </div>
                    ) : null}
                  </div>
                  {/* AUDIT: DENSITY_OVERLOAD - The verbose line-by-line source stays accessible in a collapsed drawer instead of dominating the review panel. */}
                  <details className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">
                      Raw lines
                    </summary>
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--text)]">
                      {summary.raw_lines.join("\n")}
                    </pre>
                  </details>
                </>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  Load a date range to see the summary snapshot.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Step 3</div>
              <CardTitle className="text-xl">Draft and send</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-[var(--muted)]">Recipients</label>
                <Textarea
                  rows={3}
                  value={recipientsRaw}
                  onChange={(event) => setRecipientsRaw(event.target.value)}
                  placeholder="manager@example.com, client@example.com"
                />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Subject</label>
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
              </div>
              {/* AUDIT: BUTTON_CLUTTER - The draft card now keeps one visible draft action and moves the utility actions into a compact tools tray. */}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleGenerate}
                  disabled={generating || !summary?.can_send}
                >
                  {generating ? "Generating..." : "Generate Draft"}
                </Button>
                <details className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--muted)]">
                  <summary className="cursor-pointer list-none">Draft tools</summary>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleUseSuggestedRecipients} disabled={!summary?.suggested_recipients?.length}>
                      Use Suggested
                    </Button>
                    <Button variant="outline" onClick={handleResetDraft} disabled={!summary}>
                      Reset Draft
                    </Button>
                    {ownerRiskLines.length ? (
                      <Button variant="outline" onClick={handleAppendOwnerRisk}>
                        Add Risk
                      </Button>
                    ) : null}
                    <Button variant="outline" onClick={handleCopy} disabled={!body}>
                      Copy Body
                    </Button>
                    {!summary?.can_send ? (
                      <Link href="/plans">
                        <Button variant="ghost">Upgrade Plan</Button>
                      </Link>
                    ) : null}
                  </div>
                </details>
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Body</label>
                <Textarea
                  rows={14}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Generate the AI draft or write your own email here."
                />
              </div>
              {/* AUDIT: BUTTON_CLUTTER - Gmail stays the primary finish action while other client handoffs move into a secondary tray. */}
              <div className="flex flex-wrap gap-3">
                <a href={composeLinks.gmail} target="_blank" rel="noreferrer">
                  <Button>Open Gmail</Button>
                </a>
                <details className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--muted)]">
                  <summary className="cursor-pointer list-none">Other apps</summary>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={composeLinks.outlook} target="_blank" rel="noreferrer">
                      <Button variant="outline">Outlook</Button>
                    </a>
                    <a href={composeLinks.mailto}>
                      <Button variant="ghost">Mail App</Button>
                    </a>
                  </div>
                </details>
              </div>
              {/* AUDIT: TEXT_NOISE - Reduced the mail-client explanation to one sentence because the client launch buttons already explain the delivery model. */}
              <div className="text-xs text-[var(--muted)]">Final send stays in your own mail client for review before delivery.</div>
            </CardContent>
          </Card>
        </section>

        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {ocrWarning ? <div className="text-sm text-amber-300">{ocrWarning}</div> : null}
        {steelWarning ? <div className="text-sm text-amber-300">{steelWarning}</div> : null}
        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
