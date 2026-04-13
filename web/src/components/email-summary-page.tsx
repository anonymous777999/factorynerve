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
import { buildTrustAppendix, getReportTrustSummary, type ReportTrustSummary } from "@/lib/report-trust";
import { getOcrVerificationSummary, type OcrVerificationSummary } from "@/lib/ocr";
import { getSteelOverview, type SteelOverview } from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { AiActivationNotice } from "@/components/ai-activation-notice";
import { TrustChecklist } from "@/components/trust-checklist";
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
  const [trustSummary, setTrustSummary] = useState<ReportTrustSummary | null>(null);
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
  const [trustError, setTrustError] = useState("");
  const [ocrWarning, setOcrWarning] = useState("");
  const [steelWarning, setSteelWarning] = useState("");

  const canUseEmail = useMemo(() => user?.role !== "operator" && user?.role !== "attendance", [user]);
  const steelMode = (activeFactory?.industry_type || "").toLowerCase() === "steel";

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError("");
    setStatus("");
    setTrustError("");
    setOcrWarning("");
    setSteelWarning("");
    try {
      const [summaryResult, trustResult, ocrResult, steelResult] = await Promise.allSettled([
        getEmailSummary(startDate, endDate),
        getReportTrustSummary({ startDate, endDate }),
        getOcrVerificationSummary(),
        steelMode ? getSteelOverview() : Promise.resolve(null),
      ]);

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        throw summaryResult.reason;
      }

      if (trustResult.status === "fulfilled") {
        setTrustSummary(trustResult.value);
      } else {
        setTrustSummary(null);
        const reason = trustResult.reason;
        setTrustError(
          reason instanceof Error
            ? `Trust checklist is unavailable right now: ${reason.message}`
            : "Trust checklist is unavailable right now.",
        );
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
      setTrustSummary(null);
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

  const ensureTrustReady = useCallback(() => {
    if (!trustSummary) {
      setError(trustError || "Trust checklist is still loading. Refresh the summary and try again.");
      setStatus("");
      return false;
    }
    if (!trustSummary.can_send) {
      setError(trustSummary.blocking_reason || "Trust review is still in progress.");
      setStatus("");
      return false;
    }
    return true;
  }, [trustError, trustSummary]);

  const handleGenerate = async () => {
    if (!ensureTrustReady()) {
      return;
    }
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
    if (!ensureTrustReady()) {
      return;
    }
    try {
      const messageBody = composedBody.trim();
      if (!messageBody) {
        setError("Write or generate the email body before copying it.");
        return;
      }
      await navigator.clipboard.writeText(messageBody);
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
  const trustReady = Boolean(trustSummary?.can_send);
  const trustAppendix = trustSummary ? buildTrustAppendix(trustSummary) : "";
  const composedBody = useMemo(() => {
    if (!trustAppendix) {
      return body;
    }
    return body.trim() ? `${body.trim()}\n\n${trustAppendix}` : trustAppendix;
  }, [body, trustAppendix]);
  const composeLinks = buildComposeLinks(recipients, subject, composedBody);
  const draftReady = Boolean(recipients.length && subject.trim() && body.trim());
  const composeReady = Boolean(draftReady && trustReady);
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
  const showEmailAiActivation = !summary || !summary.can_send;
  const emailAiSupport = !summary
    ? "Refresh the date range and keep using trusted reports or manual compose while the AI draft layer finishes activating."
    : `AI drafting activates on the ${summary.min_plan} plan and above. Keep the manual message flow active until this workspace is ready.`;
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
        label: "Trust Gate",
        value: trustReady ? "Ready" : "Blocked",
        tone:
          trustReady
            ? "border-cyan-400/25 bg-[rgba(34,211,238,0.08)] text-cyan-50"
            : "border-amber-400/25 bg-[rgba(245,158,11,0.08)] text-amber-50",
        detail:
          trustReady
            ? trustSummary?.confirmation || "All records are reviewed and safe to send."
            : trustSummary?.blocking_reason || trustError || "Review is still pending for this reporting window.",
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
    [bodyHasOwnerRisk, draftReady, ownerRiskLines.length, recipients.length, trustError, trustReady, trustSummary],
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
            <div className="text-sm text-red-400">{sessionError || "Please login to continue."}</div>
            <Link href="/login">
              <Button>Open Login</Button>
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
                <Button>Back to Dashboard</Button>
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
    <main className="min-h-screen px-4 py-6 pb-24 md:px-8 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
              Email Summary
            </div>
            <h1 className="mt-2 text-3xl font-semibold">Compose trusted factory updates in minutes</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Pull reporting data, layer in trusted OCR and steel risk context, then open Gmail or Outlook with an update that explains exposure, not just activity. This page should help accounts, managers, and owners leave the factory with one consistent weekly story.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-cyan-400/25 bg-[rgba(34,211,238,0.08)] px-3 py-1 text-cyan-100">
                Trust before send
              </span>
              <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted)]">
                Manual compose on your own mail client
              </span>
              <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted)]">
                Best for manager and owner weekly updates
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:flex sm:flex-wrap">
            <Link href="/dashboard">
              <Button variant="outline" className="w-full sm:w-auto">Dashboard</Button>
            </Link>
            <Link href="/reports">
              <Button className="w-full sm:w-auto">Reports</Button>
            </Link>
            <Link href="/plans">
              <Button variant="outline" className="w-full sm:w-auto">Plans</Button>
            </Link>
          </div>
          </div>
        </section>

        {status ? (
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/12 px-4 py-3 text-sm text-emerald-100">
            {status}
          </div>
        ) : null}
        {ocrWarning ? (
          <div className="rounded-3xl border border-amber-400/30 bg-amber-400/12 px-4 py-3 text-sm text-amber-100">
            {ocrWarning}
          </div>
        ) : null}
        {steelWarning ? (
          <div className="rounded-3xl border border-amber-400/30 bg-amber-400/12 px-4 py-3 text-sm text-amber-100">
            {steelWarning}
          </div>
        ) : null}
        {error || sessionError ? (
          <div className="rounded-3xl border border-rose-400/30 bg-rose-400/12 px-4 py-3 text-sm text-rose-100">
            {error || sessionError}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Date Range</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => handleQuickRange("today")}>Today</Button>
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => handleQuickRange("week")}>Last 7 Days</Button>
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => handleQuickRange("month")}>This Month</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <div>
                <label className="text-sm text-[var(--muted)]">Start Date</label>
                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">End Date</label>
                <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
              <div className="flex items-end">
                <Button className="w-full sm:w-auto" onClick={() => loadSummary()} disabled={loadingSummary}>
                  {loadingSummary ? "Loading..." : "Refresh Summary"}
                </Button>
              </div>
            </div>
            <div className="text-xs text-[var(--muted)]">
              {showEmailAiActivation
                ? "Recommended flow: refresh the range, confirm trust cards, write the message in your own words, then open your mail client."
                : "Recommended flow: refresh the range, confirm trust cards, generate the draft, then open your mail client."}
            </div>
          </CardContent>
        </Card>

        {summary ? (
          <section className={`grid gap-4 sm:grid-cols-2 ${steelOverview ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
            <Card>
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">Plan</div>
                <CardTitle>{summary.plan}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[var(--muted)]">
                Email AI requires {summary.min_plan} or higher. Owner risk wording lands best when this is paired with trusted OCR and steel review.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">Provider</div>
                <CardTitle>{summary.provider}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[var(--muted)]">
                Estimated tokens: {summary.estimated_tokens}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">Top Performer</div>
                <CardTitle>{summary.top_performer?.name || "No data in range"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[var(--muted)]">
                {summary.top_performer
                  ? `${summary.top_performer.production_percent.toFixed(1)}% production`
                  : "No data for this range."}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">Most Downtime</div>
                <CardTitle>{summary.most_downtime?.name || "No downtime spike"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[var(--muted)]">
                {summary.most_downtime
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
          </section>
        ) : (
          <AiActivationNotice
            support="Use trusted reports and scheduled updates while the AI summary layer finishes activating for this workspace."
            primaryAction={{ href: "/reports", label: "Open Trusted Reports" }}
            secondaryAction={{ href: "/premium/dashboard?notice=ai-coming-soon", label: "Open Owner Desk", variant: "outline" }}
          />
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Summary Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
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
                    <div className="rounded-2xl border border-cyan-400/30 bg-[rgba(34,211,238,0.08)] p-4 sm:col-span-2">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm text-cyan-100/80">Verified OCR Feed</div>
                          <div className="mt-1 text-xl font-semibold text-cyan-50">
                            {ocrSummary?.trusted_documents ?? 0} trusted docs / {ocrSummary?.pending_documents ?? 0} pending
                          </div>
                        </div>
                        <Link href="/ocr/verify">
                          <Button variant="outline" className="w-full sm:w-auto">Open Review Documents</Button>
                        </Link>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
                      <div className="mt-3 text-sm text-cyan-50/85">
                        Only approved OCR documents should feed owner emails and management summaries.
                      </div>
                    </div>
                    {steelOverview ? (
                      <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.08)] p-4 sm:col-span-2">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                          <div className="grid gap-2 sm:flex sm:flex-wrap">
                            <Link href="/premium/dashboard">
                              <Button variant="outline" className="w-full sm:w-auto">Owner Desk</Button>
                            </Link>
                            <Link href="/steel/charts">
                              <Button variant="ghost" className="w-full sm:w-auto">Steel Charts</Button>
                            </Link>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          {ownerRiskLines.map((line) => (
                            <div key={line} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-red-50/90">
                              {line}
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 text-sm text-red-50/80">
                          Use these lines when the owner wants a fast answer to: what is at risk this week, where should I inspect first, and who or what pattern keeps repeating?
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="mb-2 text-sm text-[var(--muted)]">Raw Summary Lines</div>
                    <pre className="whitespace-pre-wrap text-sm leading-6 text-[var(--text)]">
                      {summary.raw_lines.join("\n")}
                    </pre>
                  </div>
                </>
              ) : (
                <AiActivationNotice
                  className="bg-[linear-gradient(145deg,rgba(62,166,255,0.1),rgba(12,16,26,0.88))]"
                  support="Keep the manual summary flow active from trusted reports until this workspace has a live AI snapshot."
                  primaryAction={{ href: "/reports", label: "Open Trusted Reports" }}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Email Draft</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TrustChecklist
                summary={trustSummary}
                loading={loadingSummary}
                error={trustError}
                title="Send gate for this email"
                description="Email and copy actions stay locked until OCR, shift entry, and attendance review are complete for this date range."
              />
              {showEmailAiActivation ? (
                <AiActivationNotice
                  className="bg-[linear-gradient(145deg,rgba(62,166,255,0.1),rgba(12,16,26,0.88))]"
                  support={emailAiSupport}
                  primaryAction={{ href: "/reports", label: "Open Trusted Reports" }}
                  secondaryAction={{ href: summary ? "/plans" : "/premium/dashboard?notice=ai-coming-soon", label: summary ? "Review Plans" : "Open Owner Desk", variant: "outline" }}
                />
              ) : null}
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
              <div className="grid gap-3 sm:flex sm:flex-wrap">
                {summary?.can_send ? (
                  <Button
                    className="w-full sm:w-auto"
                    onClick={handleGenerate}
                    disabled={generating || !trustReady}
                  >
                    {generating ? "Generating..." : "Generate AI Draft"}
                  </Button>
                ) : null}
                <Button className="w-full sm:w-auto" variant="outline" onClick={handleUseSuggestedRecipients} disabled={!summary?.suggested_recipients?.length}>
                  Use Suggested Recipients
                </Button>
                <Button className="w-full sm:w-auto" variant="outline" onClick={handleResetDraft} disabled={!summary}>
                  Reset Draft
                </Button>
                {ownerRiskLines.length ? (
                  <Button className="w-full sm:w-auto" variant="outline" onClick={handleAppendOwnerRisk}>
                    Append Owner Risk Lines
                  </Button>
                ) : null}
                <Button className="w-full sm:w-auto" variant="outline" onClick={handleCopy} disabled={!body || !trustReady}>
                  Copy Body
                </Button>
                {!summary?.can_send ? (
                  <Link href="/plans">
                    <Button className="w-full sm:w-auto" variant="ghost">Upgrade Plan</Button>
                  </Link>
                ) : null}
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Body</label>
                <Textarea
                  rows={14}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={showEmailAiActivation ? "Write your owner update here." : "Generate the AI draft or write your own email here."}
                />
              </div>
              <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.03)] px-4 py-3 text-xs text-[var(--muted)]">
                Trust appendix auto-attached on copy and mail compose. Recipients will see who approved each OCR document, shift entry, and attendance record in this window.
              </div>
              <div className="grid gap-3 sm:flex sm:flex-wrap">
                {composeReady ? (
                  <a href={composeLinks.gmail} target="_blank" rel="noreferrer">
                    <Button className="w-full sm:w-auto">Open Gmail</Button>
                  </a>
                ) : (
                  <Button className="w-full sm:w-auto" disabled>Open Gmail</Button>
                )}
                {composeReady ? (
                  <a href={composeLinks.outlook} target="_blank" rel="noreferrer">
                    <Button className="w-full sm:w-auto" variant="outline">Open Outlook</Button>
                  </a>
                ) : (
                  <Button className="w-full sm:w-auto" variant="outline" disabled>Open Outlook</Button>
                )}
                {composeReady ? (
                  <a href={composeLinks.mailto}>
                    <Button className="w-full sm:w-auto" variant="ghost">Open Mail App</Button>
                  </a>
                ) : (
                  <Button className="w-full sm:w-auto" variant="ghost" disabled>Open Mail App</Button>
                )}
              </div>
              {!trustReady && trustSummary?.blocking_reason ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/12 px-4 py-3 text-sm text-amber-100">
                  {trustSummary.blocking_reason}
                </div>
              ) : null}
              <div className="text-xs text-[var(--muted)]">
                Server-side sending is intentionally disabled right now. That is deliberate: the final send stays in your own mail client so leadership can review the message before it leaves the factory.
              </div>
            </CardContent>
          </Card>
        </section>

      </div>
    </main>
  );
}
