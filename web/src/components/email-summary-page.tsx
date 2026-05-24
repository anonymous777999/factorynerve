"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Calendar, 
  RefreshCw, 
  Sparkles, 
  FileText, 
  ShieldAlert, 
  Mail, 
  HelpCircle, 
  ChevronDown, 
  Settings,
  Shield,
  Info
} from "lucide-react";

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
import { cn } from "@/lib/utils";

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
            ? `OCR summary unavailable: ${reason.message}`
            : "OCR summary unavailable.",
        );
      }

      if (steelResult.status === "fulfilled") {
        setSteelOverview(steelResult.value);
      } else {
        setSteelOverview(null);
        const reason = steelResult.reason;
        setSteelWarning(
          reason instanceof Error
            ? `Steel risk summary unavailable: ${reason.message}`
            : "Steel risk summary unavailable.",
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
      setError("Clipboard access is restricted in this browser.");
    }
  };

  const recipients = useMemo(() => {
    return recipientsRaw
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }, [recipientsRaw]);

  const composeLinks = useMemo(() => buildComposeLinks(recipients, subject, body), [recipients, subject, body]);
  const draftReady = useMemo(() => Boolean(recipients.length && subject.trim() && body.trim()), [recipients.length, subject, body]);
  
  const ownerRiskLines = useMemo(() => {
    if (!steelOverview) return [];
    const highRiskBatchCount =
      Number(steelOverview.anomaly_summary.high_batches || 0) +
      Number(steelOverview.anomaly_summary.critical_batches || 0);
    const lines = [
      `Leakage under watch: ${steelOverview.financial_access ? formatCurrency(steelOverview.anomaly_summary.total_estimated_leakage_value_inr) : "restricted"}.`,
      `Dispatch exposure: ${steelOverview.financial_access ? formatCurrency(steelOverview.profit_summary?.outstanding_invoice_amount_inr) : "restricted"} (${Number(steelOverview.profit_summary?.outstanding_invoice_weight_kg || 0).toLocaleString("en-IN")} KG).`,
      `Stock review: ${Number(steelOverview.confidence_counts.red || 0)} red and ${Number(steelOverview.confidence_counts.yellow || 0)} watch items.`,
      `Batch risk: ${highRiskBatchCount} signals (strongest operator responsibility: ${steelOverview.anomaly_summary.highest_risk_operator?.name || "none"}).`,
    ];
    if (steelOverview.anomaly_summary.highest_loss_day?.date) {
      lines.push(`Peak loss window: ${steelOverview.anomaly_summary.highest_loss_day.date}.`);
    }
    return lines;
  }, [steelOverview]);

  const bodyHasOwnerRisk = useMemo(() => body.includes("Owner Risk Watch"), [body]);
  
  const sendReadinessCards = useMemo(
    () => [
      {
        label: "Recipients",
        value: `${recipients.length}`,
        detail: recipients.length > 0 ? "Targets configured." : "Add targets.",
      },
      {
        label: "Trusted OCR",
        value: `${ocrSummary?.trusted_documents ?? 0} docs`,
        detail: (ocrSummary?.pending_documents ?? 0) === 0 ? "All verified." : `${ocrSummary?.pending_documents} pending review.`,
      },
      {
        label: "Risk Watch",
        value: bodyHasOwnerRisk ? "Attached" : "Optional",
        detail: ownerRiskLines.length > 0 ? "Anomalies scanned." : "No lines found.",
      },
      {
        label: "Draft State",
        value: draftReady ? "Ready" : "Empty",
        detail: draftReady ? "Ready to handoff." : "Compose body.",
      },
    ],
    [bodyHasOwnerRisk, draftReady, ocrSummary?.pending_documents, ocrSummary?.trusted_documents, ownerRiskLines.length, recipients.length],
  );

  const handleAppendOwnerRisk = useCallback(() => {
    if (!ownerRiskLines.length) return;
    const ownerBlock = `Owner Risk Watch\n${ownerRiskLines.map((line) => `- ${line}`).join("\n")}`;
    setBody((current) => (current.trim() ? `${current.trim()}\n\n${ownerBlock}` : ownerBlock));
    setStatus("Owner risk watch appended.");
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
    setStatus("Suggested recipients applied.");
    setError("");
  }, [summary]);

  const handleResetDraft = useCallback(() => {
    if (!summary) return;
    setRecipientsRaw(summary.suggested_recipients.join(", "));
    setSubject(summary.subject);
    setBody("");
    setStatus("Draft reset successfully.");
    setError("");
  }, [summary]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm font-medium text-text-secondary bg-surface-shell">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-action-primary" />
          <span>Synchronizing environment profile...</span>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4 bg-surface-shell">
        <Card className="w-full border-border-default bg-surface-panel shadow-2xl">
          <CardHeader>
            <div className="flex items-center gap-2 text-text-tertiary">
              <Shield className="h-5 w-5 text-status-danger" />
              <CardTitle className="text-lg">Authentication Required</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-text-secondary">
              {sessionError || "Your active workstation session has expired or is restricted. Please re-authenticate."}
            </p>
            <Link href="/access" className="block">
              <Button className="w-full bg-action-primary hover:bg-action-primary-active text-white">
                Open Access Terminal
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canUseEmail) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 bg-surface-shell">
        <Card className="w-full border-border-default bg-surface-panel shadow-2xl">
          <CardHeader>
            <div className="flex items-center gap-2 text-text-tertiary">
              <Info className="h-5 w-5 text-action-primary" />
              <CardTitle className="text-lg">Access Restriction</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-text-secondary leading-relaxed">
              Email summaries are restricted to managers, accountants, supervisors, and factory owners. Operators do not have permission to view this telemetry flow.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/dashboard">
                <Button className="w-full text-xs" variant="outline">Dashboard</Button>
              </Link>
              <Link href="/plans">
                <Button className="w-full text-xs" variant="outline">View Plans</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-shell px-4 py-4 md:px-6">
      <div className="mx-auto max-w-[1600px] flex flex-col gap-6">
        
        {/* Modern Compact Unified Page Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <span>{activeFactory?.name || "RedVortex"}</span>
              <span className="text-[10px] text-text-tertiary/60">/</span>
              <span>Reports</span>
              <span className="text-[10px] text-text-tertiary/60">/</span>
              <span className="text-text-secondary">Email Summary</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-primary">
              Compose trusted factory updates fast
            </h1>
            <p className="mt-1 text-xs text-text-secondary">
              Review verified telemetry snapshots, verify OCR documents, inspect financial risks, and compile drafts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/reports">
              <Button size="compact" variant="outline" className="text-xs">
                View Reports
              </Button>
            </Link>
            {steelMode && (
              <Link href="/premium/dashboard">
                <Button size="compact" variant="outline" className="text-xs">
                  Owner Desk
                </Button>
              </Link>
            )}
          </div>
        </header>

        {/* 3-Lane Grid Structure */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr] xl:grid-cols-[280px_1fr_420px] items-start">
          
          {/* 🛠️ LANE 1 — CONTROL RAIL (col-span-1) */}
          <div className="space-y-4 col-span-1 lg:max-w-[260px] xl:max-w-none">
            
            {/* Range Presets and Date Inputs */}
            <div className="space-y-3 rounded-lg border border-border-default bg-surface-panel p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-text-tertiary uppercase select-none">
                <Calendar className="h-3.5 w-3.5 text-action-primary" />
                <span>Range Selector</span>
              </div>
              
              {/* Presets Row */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  onClick={() => handleQuickRange("today")}
                  className="rounded-md bg-surface-elevated border border-border-subtle py-1 px-1.5 text-[10px] font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors text-center select-none cursor-pointer"
                >
                  Today
                </button>
                <button
                  onClick={() => handleQuickRange("week")}
                  className="rounded-md bg-surface-elevated border border-border-subtle py-1 px-1.5 text-[10px] font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors text-center select-none cursor-pointer"
                >
                  Last 7d
                </button>
                <button
                  onClick={() => handleQuickRange("month")}
                  className="rounded-md bg-surface-elevated border border-border-subtle py-1 px-1.5 text-[10px] font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors text-center select-none cursor-pointer"
                >
                  Month
                </button>
              </div>
              
              {/* Vertical Date Pickers */}
              <div className="space-y-2 pt-1.5">
                <div>
                  <label className="text-[9px] uppercase font-bold tracking-wider text-text-tertiary block">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-[11px] py-1 px-2.5 bg-surface-card border border-border-default rounded-md w-full font-mono mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold tracking-wider text-text-tertiary block">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 text-[11px] py-1 px-2.5 bg-surface-card border border-border-default rounded-md w-full font-mono mt-0.5"
                  />
                </div>
              </div>

              {/* Compact Refresh Call */}
              <Button
                onClick={() => loadSummary()}
                disabled={loadingSummary}
                className="w-full h-8 text-xs font-semibold mt-1 bg-action-primary hover:bg-action-primary-active text-white rounded-md flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loadingSummary ? "animate-spin" : "")} />
                <span>{loadingSummary ? "Syncing..." : "Sync Telemetry"}</span>
              </Button>
              
              <p className="text-[10px] text-text-tertiary leading-relaxed pt-0.5 border-t border-border-subtle/50 mt-1">
                Data will compile inside the defined window.
              </p>
            </div>

            {/* Environmental Context Details */}
            <div className="space-y-3 rounded-lg border border-border-default bg-surface-panel p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-text-tertiary uppercase select-none">
                <Settings className="h-3.5 w-3.5 text-text-tertiary" />
                <span>Workstation Context</span>
              </div>
              <div className="space-y-2 pt-1 text-xs text-text-secondary">
                <div className="flex items-center justify-between border-b border-border-subtle/60 pb-1.5">
                  <span className="text-text-tertiary">Plan Level</span>
                  <span className="font-mono text-text-primary capitalize text-[10px] font-semibold bg-surface-elevated px-1.5 py-0.5 rounded border border-border-subtle">
                    {summary?.plan || "free"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-border-subtle/60 pb-1.5">
                  <span className="text-text-tertiary">Model Pipeline</span>
                  <span className="font-mono text-text-primary text-[10px] truncate max-w-[130px] text-right" title={summary?.provider}>
                    {summary?.provider || "groq->anthropic"}
                  </span>
                </div>
                {summary?.top_performer?.name && (
                  <div className="flex items-center justify-between border-b border-border-subtle/60 pb-1.5">
                    <span className="text-text-tertiary">Top Performer</span>
                    <span className="text-text-primary truncate max-w-[120px] text-right font-medium">
                      {summary.top_performer.name}
                    </span>
                  </div>
                )}
                {summary?.most_downtime?.name && (
                  <div className="flex items-center justify-between border-b border-border-subtle/60 pb-1.5">
                    <span className="text-text-tertiary">Max Downtime</span>
                    <span className="text-text-primary truncate max-w-[120px] text-right font-medium">
                      {summary.most_downtime.name}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-text-tertiary">Est. AI Tokens</span>
                  <span className="font-mono text-text-primary text-[10px] font-semibold">
                    {summary?.estimated_tokens || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Collapsible Flow Guide */}
            <details className="group rounded-lg border border-border-default bg-surface-panel p-4 cursor-pointer">
              <summary className="flex items-center justify-between list-none text-xs font-semibold text-text-secondary select-none">
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-text-tertiary" />
                  <span>Onboarding Steps</span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-text-tertiary transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 space-y-3.5 text-xs text-text-secondary border-t border-border-subtle pt-3 cursor-default leading-relaxed">
                <div>
                  <div className="font-semibold text-text-primary">1. Specify Window</div>
                  <p className="mt-0.5 text-text-tertiary text-[11px]">Configure custom date limits and pull down recent factory records.</p>
                </div>
                <div>
                  <div className="font-semibold text-text-primary">2. Verify Data Integrity</div>
                  <p className="mt-0.5 text-text-tertiary text-[11px]">Audit pending OCR transcripts and review risk flags in owner watch.</p>
                </div>
                <div>
                  <div className="font-semibold text-text-primary">3. Handoff Executive Summary</div>
                  <p className="mt-0.5 text-text-tertiary text-[11px]">Click to compile the structured AI draft and open your secure mail client.</p>
                </div>
              </div>
            </details>

          </div>

          {/* 🔬 LANE 2 — TRUST / TELEMETRY (col-span-1) */}
          <div className="space-y-6 col-span-1 flex flex-col">
            
            {/* Readiness Summary Matrix Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-panel rounded-lg p-3 border border-border-default">
              {sendReadinessCards.map((item) => {
                const isReady = item.value === "Ready" || item.value.includes("docs") || Number(item.value) > 0;
                return (
                  <div key={item.label} className="flex flex-col justify-between p-2.5 rounded-md bg-surface-card border border-border-subtle">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-text-tertiary select-none">{item.label}</span>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-base font-mono font-bold text-text-primary">{item.value}</span>
                      <span className={cn("h-1.5 w-1.5 rounded-full inline-block shrink-0", isReady ? "bg-emerald-500" : "bg-amber-500")} />
                    </div>
                    <span className="mt-1 text-[10px] leading-normal text-text-secondary truncate block select-none">{item.detail}</span>
                  </div>
                );
              })}
            </div>

            {/* Summary Snapshot Data Panel */}
            <div className="rounded-lg border border-border-default bg-surface-panel p-5 space-y-4">
              <div className="text-xs font-semibold tracking-wider text-text-tertiary uppercase select-none">
                Telemetry Summary Snapshot
              </div>
              
              {summary ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Units Card */}
                  <div className="p-4 rounded-lg bg-surface-card border border-border-subtle flex flex-col justify-between">
                    <div>
                      <span className="text-xs text-text-tertiary font-semibold select-none">Production Volume</span>
                      <div className="mt-1.5 text-2xl font-mono font-bold text-text-primary">
                        {summary.totals.total_units} <span className="text-xs font-normal text-text-secondary">/ {summary.totals.total_target} units</span>
                      </div>
                    </div>
                    {/* Linear Target Progress */}
                    <div className="mt-4 pt-1">
                      <div className="h-1.5 w-full bg-surface-elevated rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-action-primary rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (summary.totals.total_units / (summary.totals.total_target || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Performance Yield */}
                  <div className="p-4 rounded-lg bg-surface-card border border-border-subtle flex flex-col justify-between">
                    <div>
                      <span className="text-xs text-text-tertiary font-semibold select-none">Performance Yield</span>
                      <div className="mt-1.5 text-2xl font-mono font-bold text-text-primary">
                        {summary.totals.average_performance.toFixed(1)}%
                      </div>
                    </div>
                    <div className="mt-4 text-[10px] text-text-secondary leading-normal select-none">
                      Relative to factory-configured baseline target.
                    </div>
                  </div>

                  {/* Downtime */}
                  <div className="p-4 rounded-lg bg-surface-card border border-border-subtle flex flex-col justify-between">
                    <div>
                      <span className="text-xs text-text-tertiary font-semibold select-none">Downtime Minutes</span>
                      <div className="mt-1.5 text-2xl font-mono font-bold text-text-primary">
                        {summary.totals.total_downtime} <span className="text-xs font-normal text-text-secondary">min</span>
                      </div>
                    </div>
                    <div className="mt-4 text-[10px] text-text-secondary leading-normal select-none">
                      Total stops detected across machinery telemetry logs.
                    </div>
                  </div>

                  {/* Manpower */}
                  <div className="p-4 rounded-lg bg-surface-card border border-border-subtle flex flex-col justify-between">
                    <div>
                      <span className="text-xs text-text-tertiary font-semibold select-none">Active Manpower</span>
                      <div className="mt-1.5 text-2xl font-mono font-bold text-text-primary">
                        {summary.totals.manpower_present} <span className="text-xs font-normal text-text-secondary">present</span>
                      </div>
                    </div>
                    <div className="mt-4 text-[10px] text-text-secondary leading-normal select-none font-medium">
                      {summary.totals.manpower_absent} attendance profiles absent.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-text-tertiary text-center py-8">
                  Compile a date range to generate telemetry metrics.
                </div>
              )}
            </div>

            {/* Verified OCR Feed */}
            <div className="rounded-lg border border-border-default bg-surface-panel p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-xs font-semibold tracking-wider text-text-tertiary uppercase select-none">
                  Verified OCR Feed
                </div>
                <Link href="/ocr/verify">
                  <Button size="compact" variant="outline" className="text-xs cursor-pointer h-7 px-3">
                    Review OCR
                  </Button>
                </Link>
              </div>
              
              <div className="p-4 rounded-lg bg-surface-card border border-border-subtle space-y-4">
                <div className="flex items-start justify-between border-b border-border-subtle/60 pb-3 gap-3">
                  <div>
                    <div className="text-sm font-bold text-text-primary">
                      {ocrSummary?.trusted_documents ?? 0} trusted documents verified
                    </div>
                    <p className="text-[11px] text-text-tertiary mt-0.5">
                      {ocrSummary?.pending_documents ?? 0} paper logbook scans awaiting human review.
                    </p>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border shrink-0 inline-block",
                    (ocrSummary?.pending_documents ?? 0) === 0
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  )}>
                    {(ocrSummary?.pending_documents ?? 0) === 0 ? "All verified" : "review pending"}
                  </span>
                </div>
                
                {/* Clean Flat Micro-Grid */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-surface-elevated/30 rounded p-2.5 border border-border-subtle">
                    <span className="text-[9px] text-text-tertiary uppercase font-bold tracking-wide select-none">Trusted Rows</span>
                    <div className="text-base font-mono font-bold mt-0.5 text-text-primary">{ocrSummary?.trusted_rows ?? 0}</div>
                  </div>
                  <div className="bg-surface-elevated/30 rounded p-2.5 border border-border-subtle">
                    <span className="text-[9px] text-text-tertiary uppercase font-bold tracking-wide select-none">Untrusted</span>
                    <div className="text-base font-mono font-bold mt-0.5 text-text-primary">{ocrSummary?.untrusted_documents ?? 0}</div>
                  </div>
                  <div className="bg-surface-elevated/30 rounded p-2.5 border border-border-subtle">
                    <span className="text-[9px] text-text-tertiary uppercase font-bold tracking-wide select-none">Last Trusted</span>
                    <div className="text-[10px] font-bold mt-1 text-text-primary truncate">
                      {ocrSummary?.last_trusted_at
                        ? new Date(ocrSummary.last_trusted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                        : "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Owner Risk Watch Panel */}
            {steelMode && steelOverview ? (
              <div className="rounded-lg border border-border-default bg-surface-panel p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold tracking-wider text-text-tertiary uppercase select-none">
                    Owner Risk Watch
                  </div>
                  <div className="flex gap-2">
                    <Link href="/premium/dashboard">
                      <Button size="compact" variant="outline" className="text-xs cursor-pointer h-7 px-3">
                        Owner Desk
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="border-l-2 border-red-500 bg-red-950/10 p-4 rounded-r-lg space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold font-mono text-red-400">
                      {steelOverview.financial_access
                        ? formatCurrency(steelOverview.anomaly_summary.total_estimated_leakage_value_inr)
                        : "Restricted Security Level"}
                    </span>
                    <span className="text-[10px] text-text-tertiary uppercase tracking-wide font-semibold select-none">leakage alert</span>
                  </div>

                  {/* Fully Flattened List Elements (No nested border boxes) */}
                  <ul className="space-y-2 pt-2.5 border-t border-red-500/10 text-xs text-red-200/90 leading-relaxed list-none">
                    {ownerRiskLines.map((line) => (
                      <li key={line} className="flex items-start gap-2">
                        <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                        <span className="overflow-safe-text">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {/* Raw Lines Data Accordion */}
            {summary && (
              <details className="group rounded-lg border border-border-default bg-surface-panel p-4 cursor-pointer">
                <summary className="flex items-center justify-between list-none text-xs font-semibold text-text-secondary select-none">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-text-tertiary" />
                    <span>Raw Data Dump</span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-text-tertiary transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3 border-t border-border-subtle pt-3 cursor-default">
                  <pre className="p-3 bg-surface-card rounded border border-border-subtle text-[10px] font-mono leading-relaxed text-text-secondary overflow-x-auto whitespace-pre">
                    {summary.raw_lines.join("\n")}
                  </pre>
                </div>
              </details>
            )}

          </div>

          {/* ✍️ LANE 3 — EXECUTION / COMPOSER (col-span-1) */}
          <div className="col-span-1 xl:sticky xl:top-4 space-y-4">
            
            <div className="rounded-lg border border-border-default bg-surface-panel p-5 space-y-4 shadow-xl">
              
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold tracking-wider text-text-tertiary uppercase select-none">
                  Executive Composer
                </div>
                {/* Verification Readiness Indicator */}
                <div className="flex items-center gap-1.5 select-none">
                  <span className="text-[10px] text-text-tertiary font-semibold">
                    {draftReady ? "Sync Clear" : "Needs Draft"}
                  </span>
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full inline-block",
                    draftReady ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  )} />
                </div>
              </div>

              {/* Composer Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] uppercase font-bold tracking-wider text-text-tertiary select-none">Recipients</label>
                  <Textarea
                    rows={2}
                    value={recipientsRaw}
                    onChange={(event) => setRecipientsRaw(event.target.value)}
                    placeholder="manager@example.com, client@example.com"
                    className="w-full text-xs font-mono py-1.5 px-2.5 bg-surface-card border border-border-default rounded-md mt-1 leading-normal focus:border-border-focus transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold tracking-wider text-text-tertiary select-none">Subject</label>
                  <Input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 bg-surface-card border border-border-default rounded-md h-8 mt-1 focus:border-border-focus transition-all"
                  />
                </div>
              </div>

              {/* Primary Action Dock */}
              <div className="flex gap-2 items-center">
                <Button
                  onClick={handleGenerate}
                  disabled={generating || !summary?.can_send}
                  className="flex-1 h-9 text-xs font-semibold bg-action-primary hover:bg-action-primary-active text-white rounded-md flex items-center justify-center gap-1.5 cursor-pointer shadow-[var(--shadow-xs)]"
                >
                  <Sparkles className={cn("h-3.5 w-3.5", generating ? "animate-pulse" : "")} />
                  <span>{generating ? "Compiling..." : "Generate AI Draft"}</span>
                </Button>

                {/* Draft Tools Popover Menu */}
                <details className="relative group shrink-0">
                  <summary className="list-none cursor-pointer">
                    <Button size="compact" variant="outline" className="h-9 px-3 text-xs flex items-center gap-1 cursor-pointer">
                      <span>Tools</span>
                      <ChevronDown className="h-3 w-3 text-text-tertiary transition-transform group-open:rotate-180" />
                    </Button>
                  </summary>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-surface-overlay border border-border-default rounded-md shadow-2xl z-50 p-1 flex flex-col gap-0.5 cursor-default">
                    <button
                      onClick={handleUseSuggestedRecipients}
                      disabled={!summary?.suggested_recipients?.length}
                      className="w-full text-left text-xs px-3 py-2 rounded-md hover:bg-surface-selected text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-text-secondary cursor-pointer transition-colors"
                    >
                      Use Suggested
                    </button>
                    <button
                      onClick={handleResetDraft}
                      disabled={!summary}
                      className="w-full text-left text-xs px-3 py-2 rounded-md hover:bg-surface-selected text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-text-secondary cursor-pointer transition-colors"
                    >
                      Reset Config
                    </button>
                    {ownerRiskLines.length > 0 && (
                      <button
                        onClick={handleAppendOwnerRisk}
                        className="w-full text-left text-xs px-3 py-2 rounded-md hover:bg-surface-selected text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
                      >
                        Append Owner Risk
                      </button>
                    )}
                    <button
                      onClick={handleCopy}
                      disabled={!body}
                      className="w-full text-left text-xs px-3 py-2 rounded-md hover:bg-surface-selected text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-text-secondary cursor-pointer transition-colors"
                    >
                      Copy Body Text
                    </button>
                  </div>
                </details>
              </div>

              {/* Text Writing Area */}
              <div>
                <div className="flex items-center justify-between select-none">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-text-tertiary block">AI Draft Content</label>
                  <span className="text-[9px] text-text-tertiary/60 font-mono">DASHED STATE: PRE-VERIFIED</span>
                </div>
                <Textarea
                  rows={13}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Draft compilation body text."
                  className="w-full text-xs font-mono py-2.5 px-3 bg-surface-card border border-border-default rounded-md mt-1.5 leading-relaxed resize-y min-h-[260px] border-dashed border-action-primary/30 focus:border-border-focus outline-none"
                  style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
                />
              </div>

              {/* Dispatch Action Handoffs */}
              <div className="space-y-2 pt-2 border-t border-border-subtle/80">
                <div className="flex gap-2">
                  <a href={composeLinks.gmail} target="_blank" rel="noreferrer" className="flex-1">
                    <Button className="w-full h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
                      <Mail className="h-3.5 w-3.5" />
                      <span>Send with Gmail</span>
                    </Button>
                  </a>
                  
                  <details className="relative group shrink-0">
                    <summary className="list-none cursor-pointer">
                      <Button size="compact" variant="outline" className="h-9 px-3 text-xs flex items-center gap-1 cursor-pointer">
                        <span>Handoff</span>
                        <ChevronDown className="h-3 w-3 text-text-tertiary transition-transform group-open:rotate-180" />
                      </Button>
                    </summary>
                    <div className="absolute right-0 bottom-full mb-2 w-40 bg-surface-overlay border border-border-default rounded-md shadow-2xl z-50 p-1 flex flex-col gap-0.5 cursor-default">
                      <a 
                        href={composeLinks.outlook} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="w-full text-left text-xs px-3 py-2 rounded-md hover:bg-surface-selected text-text-secondary hover:text-text-primary cursor-pointer transition-colors block"
                      >
                        Open Outlook
                      </a>
                      <a 
                        href={composeLinks.mailto}
                        className="w-full text-left text-xs px-3 py-2 rounded-md hover:bg-surface-selected text-text-secondary hover:text-text-primary cursor-pointer transition-colors block"
                      >
                        Default Mailto
                      </a>
                    </div>
                  </details>
                </div>
                <p className="text-[10px] text-text-tertiary text-center leading-normal select-none">
                  Transfer handles draft payload securely in native secure client.
                </p>
              </div>

            </div>

          </div>
          
        </div>

        {/* Global Workstation Status Signals */}
        {(status || ocrWarning || steelWarning || error || sessionError) && (
          <div className="rounded-lg border border-border-default bg-surface-panel p-4 flex flex-col gap-2">
            <div className="text-xs uppercase font-bold tracking-wider text-text-tertiary select-none">
              System Events & Signals
            </div>
            <div className="space-y-1.5 text-xs">
              {status && (
                <div className="text-emerald-400 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>{status}</span>
                </div>
              )}
              {ocrWarning && (
                <div className="text-amber-300 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shrink-0" />
                  <span>{ocrWarning}</span>
                </div>
              )}
              {steelWarning && (
                <div className="text-amber-300 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shrink-0" />
                  <span>{steelWarning}</span>
                </div>
              )}
              {(error || sessionError) && (
                <div className="text-status-danger flex items-center gap-2 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-danger shrink-0" />
                  <span>{error || sessionError}</span>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
