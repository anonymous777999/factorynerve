"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";

import { HealthTrendChart } from "@/components/charts/health-trend-chart";
import { GuidanceBlock } from "@/components/ui/guidance-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  askNaturalLanguageQuery,
  getAiUsage,
  getAnomalies,
  getHealthTrend,
  type AiUsage,
  type AnomalyResponse,
  type HealthTrendResponse,
  type NaturalLanguageQueryResponse,
} from "@/lib/ai";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { getQuotaHealth, quotaLabel } from "@/lib/quota-health";
import { useSession } from "@/lib/use-session";

const AUTO_REFRESH_MS = 180_000; // Reduced to 3 minutes from 45 seconds

type SavedPreset = {
  id: string;
  label: string;
  question: string;
  domain?: string;
};

type DomainTab = {
  id: string;
  emoji: string;
  label: string;
  i18nKey: string;
};

const DOMAIN_TABS: DomainTab[] = [
  { id: "attendance",     emoji: "\u{1F465}",  label: "Attendance",   i18nKey: "ai.domain.attendance" },
  { id: "dispatch",       emoji: "\u{1F69B}",  label: "Dispatch",     i18nKey: "ai.domain.dispatch" },
  { id: "theft_fraud",    emoji: "\u{1F6A8}",  label: "Fraud & Theft", i18nKey: "ai.domain.theft_fraud" },
  { id: "finance",        emoji: "\u{1F4B0}",  label: "Finance",      i18nKey: "ai.domain.finance" },
  { id: "inventory",      emoji: "\u{1F4E6}",  label: "Inventory",    i18nKey: "ai.domain.inventory" },
  { id: "production",     emoji: "\u{1F3ED}",  label: "Production",   i18nKey: "ai.domain.production" },
  { id: "audit_trail",    emoji: "\u{1F4CB}",  label: "Audit Trail",  i18nKey: "ai.domain.audit_trail" },
  { id: "owner_insights", emoji: "\u{1F451}",  label: "Owner",        i18nKey: "ai.domain.owner_insights" },
  { id: "ocr",            emoji: "\u{1F4C4}",  label: "OCR",          i18nKey: "ai.domain.ocr" },
  { id: "alerts",         emoji: "\u26A0\uFE0F", label: "Alerts",      i18nKey: "ai.domain.alerts" },
  { id: "general",        emoji: "\u{1F916}",  label: "General",      i18nKey: "ai.domain.general" },
];

type DomainPresetItem = {
  id: string;
  label: string;
  question: string;
};

type DomainPresetMap = Record<string, DomainPresetItem[]>;

const DOMAIN_PRESETS: DomainPresetMap = {
  attendance: [
    { id: "att-today",       label: "Who came today?",               question: "Who came to work today?" },
    { id: "att-absent-yest", label: "Who was absent yesterday?",     question: "Who was absent yesterday?" },
    { id: "att-overtime",    label: "Overtime this week",            question: "How much overtime was logged this week?" },
    { id: "att-rate",        label: "Attendance rate this month",    question: "What is the attendance rate this month?" },
    { id: "att-shift-today", label: "Workers by shift today",        question: "Which shift has the most workers today?" },
    { id: "att-manpower",    label: "Manpower by shift this week",   question: "Show me manpower by shift this week" },
  ],
  dispatch: [
    { id: "dsp-today",       label: "Dispatches today",              question: "How many dispatches happened today?" },
    { id: "dsp-weekly",      label: "Dispatches this week",          question: "Show me dispatches this week by destination" },
    { id: "dsp-pending",     label: "Pending dispatches",            question: "Which dispatches are still pending?" },
    { id: "dsp-vs-target",   label: "Dispatch vs target this month", question: "How do dispatches compare to target this month?" },
    { id: "dsp-weight",      label: "Total dispatched weight",       question: "What is the total dispatched weight this week?" },
  ],
  theft_fraud: [
    { id: "fraud-patterns",  label: "Suspicious patterns this week", question: "Are there any suspicious dispatch patterns this week?" },
    { id: "fraud-weight",    label: "Weight mismatch alerts",        question: "Show me weight mismatch alerts in recent batches" },
    { id: "fraud-inv-loss",  label: "Inventory loss signals",        question: "What inventory loss signals were detected this month?" },
    { id: "fraud-alerts",    label: "Recent fraud alerts",           question: "Which fraud alerts need my attention right now?" },
    { id: "fraud-leakage",   label: "Leakage detected this month",   question: "How much leakage was detected this month?" },
  ],
  finance: [
    { id: "fin-revenue",     label: "Monthly revenue summary",       question: "What is the revenue summary for this month?" },
    { id: "fin-outstanding", label: "Outstanding payments",          question: "How much is outstanding in payments right now?" },
    { id: "fin-overdue",     label: "Overdue invoices",              question: "Which invoices are overdue for payment?" },
    { id: "fin-expenses",    label: "Expense breakdown",             question: "Show me expense breakdown for this month" },
    { id: "fin-margin",      label: "Profit margin trend",           question: "What is the current profit margin trend?" },
  ],
  inventory: [
    { id: "inv-stock",       label: "Current stock levels",          question: "What are the current stock levels across all items?" },
    { id: "inv-low-stock",   label: "Items running low",             question: "Which inventory items are running low?" },
    { id: "inv-consumption", label: "Material consumption this month", question: "What is the material consumption this month?" },
    { id: "inv-value",       label: "Total inventory value",         question: "What is the total inventory value right now?" },
    { id: "inv-slow",        label: "Slow-moving items",             question: "Which inventory items are slow-moving or dead stock?" },
  ],
  production: [
    { id: "prod-today",      label: "Today's production output",     question: "What is today's production output?" },
    { id: "prod-efficiency", label: "Production efficiency rate",    question: "What is the production efficiency rate this week?" },
    { id: "prod-downtime",   label: "Downtime by shift",             question: "Show me downtime by shift this week" },
    { id: "prod-quality",    label: "Batch quality summary",         question: "What is the batch quality summary for this month?" },
    { id: "prod-vs-target",  label: "Production vs target",          question: "How does production compare to target this month?" },
  ],
  audit_trail: [
    { id: "audit-recent",    label: "Recent entry changes",          question: "Show me the recent changes to production entries" },
    { id: "audit-yesterday", label: "Who modified yesterday's data", question: "Who modified yesterday's production data?" },
    { id: "audit-suspicious", label: "Suspicious activity log",      question: "Show me any suspicious activity in the audit log" },
  ],
  owner_insights: [
    { id: "owner-health",    label: "Factory health score",          question: "What is the factory health score right now?" },
    { id: "owner-problems",  label: "Top 3 problems",                question: "What are the top 3 problems in the factory right now?" },
    { id: "owner-mom",       label: "This month vs last month",      question: "Compare this month to last month across all metrics" },
    { id: "owner-rev-vs-exp", label: "Revenue vs expenses",          question: "How do revenue and expenses compare this month?" },
    { id: "owner-overview",  label: "Overall performance",           question: "Give me an overall factory performance summary" },
    { id: "owner-raw-waste", label: "Raw material waste",            question: "How much raw material was wasted in production this month?" },
  ],
  ocr: [
    { id: "ocr-pending",     label: "Pending OCR documents",         question: "How many OCR documents are pending processing?" },
    { id: "ocr-accuracy",    label: "OCR accuracy rate",             question: "What is the OCR accuracy rate today?" },
    { id: "ocr-failures",    label: "Failed OCR jobs",               question: "Which OCR jobs failed in the last 24 hours?" },
    { id: "ocr-processed",   label: "Documents processed this week", question: "How many documents were processed by OCR this week?" },
  ],
  alerts: [
    { id: "alerts-active",   label: "Active alerts now",             question: "Show me all active alerts right now" },
    { id: "alerts-critical", label: "Critical unresolved alerts",    question: "Which critical alerts are still unresolved?" },
    { id: "alerts-summary",  label: "Alert summary this week",       question: "Give me an alert summary for this week" },
    { id: "alerts-ignored",  label: "Ignored alerts",                question: "Which alerts have been ignored and need attention?" },
  ],
  general: [
    { id: "gen-overview",    label: "Factory overview",              question: "Give me a complete factory overview" },
    { id: "gen-yesterday",   label: "Yesterday's shift summary",     question: "Show me yesterday's shift summary" },
    { id: "gen-happening",   label: "What's happening right now",    question: "What's happening in the factory right now?" },
    { id: "gen-today-vs-yest", label: "Today vs yesterday",         question: "Compare today's production to yesterday" },
  ],
};

function presetStorageKey(userId?: number) {
  return `dpr-ai-nlq-presets:${userId || "anon"}`;
}

function formatDateTime(value?: string, locale = "en-IN") {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AiInsightsPage() {
  const { locale, t } = useI18n();
  useI18nNamespaces(["common", "ai"]);

  const { user, loading, error: sessionError } = useSession();

  // Domain tab state
  const [activeDomain, setActiveDomain] = useState("attendance");

  // Build domain-filtered presets
  const builtInPresets = useMemo<SavedPreset[]>(() => {
    const all = DOMAIN_PRESETS[activeDomain] || DOMAIN_PRESETS.general || [];
    return all.map((p) => ({ ...p, domain: activeDomain }));
  }, [activeDomain]);

  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyResponse | null>(null);
  const [healthTrend, setHealthTrend] = useState<HealthTrendResponse | null>(null);
  const [question, setQuestion] = useState("");
  const [nlqResult, setNlqResult] = useState<NaturalLanguageQueryResponse | null>(null);
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [days, setDays] = useState("14");
  const [pageLoading, setPageLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [queryBusy, setQueryBusy] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  // Track if we've auto-loaded the health preset
  const autoLoadedHealthRef = useRef(false);

  // Use refs to prevent unnecessary re-renders
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<{ usage: AiUsage | null; anomalies: AnomalyResponse | null }>({ usage: null, anomalies: null });
  const hasLoadedOnceRef = useRef(false);

  // Memoize health calculations to prevent re-calculations
  const summaryHealth = useMemo(() => getQuotaHealth(usage?.summary_used, usage?.summary_limit), [usage?.summary_used, usage?.summary_limit]);
  const smartHealth = useMemo(() => getQuotaHealth(usage?.smart_used, usage?.smart_limit), [usage?.smart_used, usage?.smart_limit]);

  // Initialize question only once
  useEffect(() => {
    if (!question && builtInPresets.length > 0) {
      setQuestion(builtInPresets[0]?.question || "");
    }
  }, [question, builtInPresets]);

  // Auto-load factory health score on first visit
  useEffect(() => {
    if (!user || autoLoadedHealthRef.current) return;
    if (!hasLoadedOnce) return;

    autoLoadedHealthRef.current = true;
    // Switch to owner_insights domain and set the health score question
    setActiveDomain("owner_insights");
    const healthPreset = DOMAIN_PRESETS.owner_insights?.find((p) => p.id === "owner-health");
    if (healthPreset) {
      setQuestion(healthPreset.question);
      // Auto-execute the query after a brief delay for UI state to settle
      const timer = setTimeout(() => {
        setQueryBusy(true);
        setError("");
        setStatus("");
        askNaturalLanguageQuery(healthPreset.question)
          .then((response) => {
            setNlqResult(response);
            setStatus(t("ai.status.answered", "NLQ answered with {{provider}}.", { provider: response.provider }));
          })
          .catch((err) => {
            if (err instanceof ApiError) {
              setError(err.message);
            } else if (err instanceof Error) {
              setError(err.message);
            } else {
              setError(t("ai.errors.answer", "Could not answer the question."));
            }
          })
          .finally(() => {
            setQueryBusy(false);
          });
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [user, hasLoadedOnce, t]);

  const loadAiHome = useCallback(async (options?: { background?: boolean; selectedDays?: number }) => {
    const selectedDays = options?.selectedDays ?? (Number(days) || 14);
    const shouldBackground = Boolean(options?.background) || hasLoadedOnceRef.current;

    // Less aggressive visual feedback for background updates
    if (shouldBackground) {
      setRefreshing(true);
    } else {
      setPageLoading(true);
    }

    setError("");
    try {
      const [usageResult, anomalyResult, healthTrendResult] = await Promise.all([
        getAiUsage(),
        getAnomalies(selectedDays),
        getHealthTrend(selectedDays),
      ]);

      // Only update state if data actually changed (deep comparison)
      const hasUsageChanged = JSON.stringify(lastDataRef.current.usage) !== JSON.stringify(usageResult);
      const hasAnomalyChanged = JSON.stringify(lastDataRef.current.anomalies) !== JSON.stringify(anomalyResult);

      if (hasUsageChanged) {
        setUsage(usageResult);
        lastDataRef.current.usage = usageResult;
      }

      if (hasAnomalyChanged) {
        setAnomalies(anomalyResult);
        lastDataRef.current.anomalies = anomalyResult;
      }

      setHealthTrend(healthTrendResult);

      // Only update timestamp if data actually changed
      if (hasUsageChanged || hasAnomalyChanged || !shouldBackground) {
        setLastUpdatedAt(new Date().toISOString());
      }

    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("ai.errors.load", "Could not load AI insights."));
      }
    } finally {
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
      setPageLoading(false);
      setRefreshing(false);
    }
  }, [days, t]);

  useEffect(() => {
    if (!user) {
      setError("");
      setStatus("");
      setLastUpdatedAt(null);
      setHasLoadedOnce(false);
      hasLoadedOnceRef.current = false;
      setPageLoading(false);
      return;
    }

    // Only show page loader if we haven't loaded anything yet
    // This prevents the full-page skeleton from flickering on every days/range change
    if (!hasLoadedOnceRef.current) {
      setPageLoading(true);
    }

    void loadAiHome();
  }, [loadAiHome, user]);

  // Improved auto-refresh with better cleanup
  useEffect(() => {
    if (!user) return;

    const refresh = () => {
      if (!document.hidden) {
        void loadAiHome({ background: true });
      }
    };

    // Clear existing timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }

    refreshTimerRef.current = setInterval(refresh, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadAiHome, user]);

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    try {
      const raw = window.localStorage.getItem(presetStorageKey(user.id));
      if (!raw) {
        setSavedPresets([]);
        return;
      }
      const parsed = JSON.parse(raw) as SavedPreset[];
      if (Array.isArray(parsed)) {
        setSavedPresets(parsed.filter((item) => item && item.id && item.label && item.question));
      }
    } catch {
      setSavedPresets([]);
    }
  }, [user]);

  const savePresets = (next: SavedPreset[]) => {
    setSavedPresets(next);
    if (typeof window === "undefined" || !user) return;
    window.localStorage.setItem(presetStorageKey(user.id), JSON.stringify(next));
  };

  const combinedPresets = useMemo(() => [...builtInPresets, ...savedPresets], [builtInPresets, savedPresets]);

  const handleQuestion = async () => {
    setQueryBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await askNaturalLanguageQuery(question);
      setNlqResult(response);
      setStatus(t("ai.status.answered", "NLQ answered with {{provider}}.", { provider: response.provider }));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("ai.errors.answer", "Could not answer the question."));
      }
    } finally {
      setQueryBusy(false);
    }
  };

  const handleSavePreset = () => {
    setSavingPreset(true);
    const label = presetName.trim() || t("ai.preset.custom_label", "Preset {{count}}", { count: savedPresets.length + 1 });
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError(t("ai.errors.empty_preset", "Enter a question before saving a preset."));
      setSavingPreset(false);
      return;
    }
    const nextPreset: SavedPreset = {
      id: `${Date.now()}`,
      label,
      question: trimmedQuestion,
    };
    savePresets([nextPreset, ...savedPresets].slice(0, 8));
    setPresetName("");
    setStatus(t("ai.status.saved_preset", "Saved preset \"{{label}}\".", { label }));
    setError("");
    setSavingPreset(false);
  };

  const handleDeletePreset = (presetId: string) => {
    const next = savedPresets.filter((item) => item.id !== presetId);
    savePresets(next);
    setStatus(t("ai.status.deleted_preset", "Saved preset removed."));
  };

  if (loading || (pageLoading && user && !hasLoadedOnce)) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-36 rounded-[2rem]" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Skeleton className="h-[28rem] rounded-2xl" />
            <Skeleton className="h-[28rem] rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t("ai.title", "AI Insights")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || t("ai.sign_in_required", "Please sign in to continue.")}</div>
            <Link href="/access">
              <Button>{t("dashboard.action.open_login", "Open Access")}</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
          <div className="max-w-4xl space-y-3">
            <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">{t("ai.title", "AI Insights")}</div>
            <h1 className="text-3xl font-semibold">{t("ai.hero.title", "Ask an operations question")}</h1>
            <p className="max-w-3xl text-sm text-[var(--muted)]">{t("ai.hero.subtitle", "Ask now. Check drift only when needed.")}</p>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              <span className="rounded-full border border-[var(--border)] px-3 py-1.5">
                {t("ai.hero.plan", "Plan")}: <span className="font-semibold text-[var(--text)] capitalize">{usage?.plan || "-"}</span>
              </span>
              <span className="rounded-full border border-[var(--border)] px-3 py-1.5">
                {refreshing
                  ? t("ai.hero.refreshing", "Refreshing AI...")
                  : lastUpdatedAt
                    ? t("ai.hero.updated", "Updated {{value}}", { value: formatDateTime(lastUpdatedAt, locale) })
                    : t("ai.hero.live_updates", "Live updates every 3 minutes")}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="px-4 py-2 text-xs"
              onClick={() => document.getElementById("nlq-card")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              {t("ai.actions.ask", "Ask AI")}
            </Button>
            <Button
              variant="outline"
              className="px-4 py-2 text-xs"
              onClick={() => {
                void loadAiHome({ background: true, selectedDays: Number(days) || 14 });
              }}
              disabled={false}
            >
              {t("common.refresh", "Refresh")}
            </Button>
            <details className="group">
              <summary className="list-none">
                <Button variant="outline" className="px-4 py-2 text-xs">
                  {t("ai.actions.more_tools", "More tools")}
                </Button>
              </summary>
              <div className="mt-3 flex flex-wrap gap-3 rounded-[1.35rem] border border-[var(--border)] bg-[rgba(10,14,24,0.82)] p-3">
                <Link href="/entry">
                  <Button variant="outline" className="px-4 py-2 text-xs">{t("ai.actions.entry", "DPR Entry")}</Button>
                </Link>
                <Link href="/reports">
                  <Button variant="outline" className="px-4 py-2 text-xs">{t("ai.actions.reports", "Reports")}</Button>
                </Link>
              </div>
            </details>
          </div>
        </section>

        <GuidanceBlock
          surfaceKey="ai-insights"
          title={t("ai.steps.title", "How this works")}
          summary={t("ai.steps.summary", "Ask first. Open quota or drift only when you need more context.")}
          eyebrow={t("ai.steps.eyebrow", "On demand")}
          autoOpenVisits={1}
          className="border border-[var(--border)] bg-[rgba(18,22,34,0.92)]"
        >
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                title: t("ai.steps.ask_title", "Ask"),
                body: t("ai.steps.ask_body", "Type the KPI or trend question you need answered right now."),
              },
              {
                title: t("ai.steps.answer_title", "Check answer"),
                body: nlqResult
                  ? t("ai.steps.answer_body_ready", "Latest answer came from {{provider}}.", { provider: nlqResult.provider })
                  : t("ai.steps.answer_body_empty", "The answer panel stays ready for the next NLQ result."),
              },
              {
                title: t("ai.steps.investigate_title", "Investigate"),
                body: t("ai.steps.investigate_body", "Use anomaly drift and quota context only when you need to validate or extend the answer."),
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.42)] px-4 py-4">
                <div className="text-sm font-semibold text-[var(--text)]">{item.title}</div>
                <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.body}</div>
              </div>
            ))}
          </div>
        </GuidanceBlock>

        <details className="group rounded-[2rem] border border-[var(--border)] bg-[rgba(18,22,34,0.92)] shadow-xl">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-6 py-5">
            <div>
              <div className="text-sm text-[var(--muted)]">{t("ai.quota.title", "Plan and quota")}</div>
              <div className="mt-1 text-xl font-semibold text-[var(--text)]">{t("ai.quota.subtitle", "Usage context")}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-caption ${summaryHealth.badgeClass}`}>{summaryHealth.badge}</span>
              <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-caption ${smartHealth.badgeClass}`}>{smartHealth.badge}</span>
            </div>
          </summary>
          <div className="grid gap-4 border-t border-[var(--border)] px-6 py-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-[var(--muted)]">{t("ai.quota.summary", "Summary quota")}</div>
                    <CardTitle>{quotaLabel(usage?.summary_used, usage?.summary_limit)}</CardTitle>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-caption ${summaryHealth.badgeClass}`}>
                    {summaryHealth.badge}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[var(--muted)]">
                <div className="text-xs uppercase tracking-caption text-white/80">{summaryHealth.detail}</div>
                <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                  <div className={`h-2 rounded-full ${summaryHealth.barClass}`} style={{ width: `${summaryHealth.percent}%` }} />
                </div>
                <div>{t("ai.quota.summary_detail", "Used by AI summaries and NLQ.")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-[var(--muted)]">{t("ai.quota.smart", "Smart quota")}</div>
                    <CardTitle>{quotaLabel(usage?.smart_used, usage?.smart_limit)}</CardTitle>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-caption ${smartHealth.badgeClass}`}>
                    {smartHealth.badge}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[var(--muted)]">
                <div className="text-xs uppercase tracking-caption text-white/80">{smartHealth.detail}</div>
                <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                  <div className={`h-2 rounded-full ${smartHealth.barClass}`} style={{ width: `${smartHealth.percent}%` }} />
                </div>
                <div>{t("ai.quota.smart_detail", "Used by smart input.")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">{t("ai.quota.current_plan", "Current plan")}</div>
                <CardTitle className="capitalize">{usage?.plan || "-"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[var(--muted)]">
                {t("ai.quota.current_plan_detail", "NLQ at {{nlq}}. Anomalies at {{anomaly}}.", {
                  nlq: usage?.nlq_min_plan || "-",
                  anomaly: usage?.anomaly_min_plan || "-",
                })}
              </CardContent>
            </Card>
          </div>
        </details>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card id="nlq-card">
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("ai.query.eyebrow", "Natural language query")}</div>
              <CardTitle className="text-xl">{t("ai.query.title", "Ask a factory question")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-[var(--muted)]">{t("ai.query.label", "Question")}</label>
                <Input value={question} onChange={(event) => setQuestion(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleQuestion} disabled={queryBusy}>
                  {queryBusy ? t("ai.query.thinking", "Thinking...") : t("ai.actions.ask", "Ask AI")}
                </Button>
                <Button variant="outline" onClick={() => setQuestion(builtInPresets[0]?.question || "")}>
                  {t("ai.query.example", "Example")}
                </Button>
              </div>

              {/* Domain Tab Bar */}
              <div className="overflow-x-auto pb-1">
                <div className="flex gap-1.5 min-w-max">
                  {DOMAIN_TABS.map((tab) => {
                    const isActive = activeDomain === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveDomain(tab.id)}
                        className={
                          isActive
                            ? "flex items-center gap-1.5 rounded-full border border-[var(--accent)] bg-[rgba(197,109,45,0.12)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150"
                            : "flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[rgba(12,16,26,0.72)] px-3.5 py-1.5 text-xs font-medium text-[var(--muted)] transition-all duration-150 hover:border-[rgba(197,109,45,0.3)] hover:text-white"
                        }
                      >
                        <span className="text-sm">{tab.emoji}</span>
                        <span>{t(tab.i18nKey, tab.label)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Domain Presets */}
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-caption text-[var(--muted)]">
                    {DOMAIN_TABS.find((t) => t.id === activeDomain)?.emoji}{" "}
                    {t("ai.query.presets", "Prompt presets")}
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">
                    {builtInPresets.length} question{builtInPresets.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {builtInPresets.map((preset) => (
                    <Button
                      key={preset.id}
                      variant="outline"
                      size="sm"
                      className="h-auto rounded-full px-3.5 py-2 text-xs"
                      onClick={() => setQuestion(preset.question)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom presets (saved + save form) */}
              {savedPresets.length > 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[rgba(12,16,26,0.42)] p-4">
                  <div className="mb-3 text-xs uppercase tracking-caption text-[var(--muted)]">
                    {t("ai.query.saved", "Saved presets")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {savedPresets.map((preset) => (
                      <div key={preset.id} className="flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-auto rounded-full px-3.5 py-2 text-xs"
                          onClick={() => setQuestion(preset.question)}
                        >
                          {preset.label}
                        </Button>
                        <button
                          type="button"
                          className="text-[10px] text-[var(--muted)] underline underline-offset-4 hover:text-red-300"
                          onClick={() => handleDeletePreset(preset.id)}
                        >
                          {t("ai.query.delete", "Delete")}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[rgba(12,16,26,0.42)] p-4 md:grid-cols-[1fr_auto]">
                <Input
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                  placeholder={t("ai.query.preset_placeholder", "Save current question as preset...")}
                />
                <Button variant="outline" onClick={handleSavePreset} disabled={savingPreset}>
                  {savingPreset ? t("ai.query.saving", "Saving...") : t("ai.query.save_preset", "Save preset")}
                </Button>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-caption text-[var(--muted)]">{t("ai.query.answer", "Answer")}</div>
                  <div className="flex gap-2">
                    {/* Language badge */}
                    {nlqResult?.language && nlqResult.language !== "english" ? (
                      <span className="rounded-full border border-[rgba(168,85,247,0.3)] bg-[rgba(168,85,247,0.08)] px-2.5 py-0.5 text-[10px] tracking-caption text-purple-200">
                        {nlqResult.language === "hindi" ? "\u0939\u093F\u0928\u094D\u0926\u0940" : "Hinglish"}
                      </span>
                    ) : null}
                    {/* Health score badge */}
                    {nlqResult?.health_score != null ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] tracking-caption font-semibold ${
                          nlqResult.health_label === "good"
                            ? "bg-emerald-900/30 text-emerald-300 border border-emerald-700/40"
                            : nlqResult.health_label === "needs_attention"
                              ? "bg-amber-900/30 text-amber-300 border border-amber-700/40"
                              : nlqResult.health_label === "at_risk"
                                ? "bg-orange-900/30 text-orange-300 border border-orange-700/40"
                                : "bg-red-900/30 text-red-300 border border-red-700/40"
                        }`}
                      >
                        {t("ai.query.health", "Health: {{value}}/100", { value: nlqResult.health_score })}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--text)]">
                  {nlqResult?.answer || t("ai.query.answer_empty", "Run a query to see the answer here.")}
                </div>

                {/* Action items */}
                {nlqResult?.action_items && nlqResult.action_items.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <div className="text-xs uppercase tracking-caption text-[var(--muted)]">{t("ai.query.actions", "Recommended actions")}</div>
                    {nlqResult.action_items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 rounded-xl border border-[rgba(99,102,241,0.2)] bg-[rgba(99,102,241,0.04)] px-3 py-2.5"
                      >
                        <span className={[
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                          item.priority <= 1
                            ? "bg-red-800/40 text-red-200"
                            : item.priority === 2
                              ? "bg-amber-800/40 text-amber-200"
                              : "bg-indigo-800/40 text-indigo-200",
                        ].join(" ")}>
                          {item.priority}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[var(--text)]">{item.action}</div>
                          <div className="text-xs text-[var(--muted)] mt-0.5">{item.reason}</div>
                          {item.deadline ? (
                            <span className={[
                              "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] tracking-caption",
                              item.deadline === "urgent"
                                ? "bg-red-900/30 text-red-200 border border-red-700/40"
                                : "bg-slate-800/40 text-slate-300 border border-slate-700/40",
                            ].join(" ")}>
                              {t("ai.query.deadline", "By: {{value}}", { value: item.deadline })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {nlqResult ? (
                  <details className="mt-4 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
                    <summary className="cursor-pointer list-none px-3 py-3 text-xs uppercase tracking-label text-[var(--muted)]">
                      {t("ai.query.details", "Query details")}
                    </summary>
                    <div className="space-y-2 border-t border-[var(--border)] px-3 py-3 text-xs text-[var(--muted)]">
                      <div>{t("ai.query.details.provider", "Provider: {{value}}", { value: nlqResult.provider })}</div>
                      <div>{t("ai.query.details.generated", "Generated: {{value}}", { value: formatDateTime(nlqResult.generated_at, locale) })}</div>
                      <div>{t("ai.query.details.shape", "Query shape: {{value}}", { value: JSON.stringify(nlqResult.structured_query) })}</div>
                    </div>
                  </details>
                ) : null}
              </div>
              {nlqResult?.data_points?.length ? (
                <details className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)]">
                  <summary className="cursor-pointer list-none px-4 py-4 text-xs uppercase tracking-caption text-[var(--muted)]">
                    {t("ai.query.data_points", "Data points")}
                  </summary>
                  <div className="space-y-2 border-t border-[var(--border)] px-4 py-4">
                    {nlqResult.data_points.map((item) => (
                      <div key={item.group} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-[var(--muted)]">{item.group}</span>
                        <span className="font-semibold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>

          <details className="rounded-[2rem] border border-[var(--border)] bg-[rgba(18,22,34,0.92)] shadow-xl" open={Boolean(anomalies?.items?.length)}>
            <summary className="flex cursor-pointer list-none flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm text-[var(--muted)]">{t("ai.anomalies.title", "Anomaly alerts")}</div>
                <div className="mt-1 text-xl font-semibold text-[var(--text)]">{t("ai.anomalies.subtitle", "Operational drift scanner")}</div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                >
                  <option value="7">{t("ai.anomalies.range.7", "Last 7 days")}</option>
                  <option value="14">{t("ai.anomalies.range.14", "Last 14 days")}</option>
                  <option value="30">{t("ai.anomalies.range.30", "Last 30 days")}</option>
                </select>
                <Button
                  variant="outline"
                  className="px-4 py-2 text-xs"
                  onClick={() => {
                    void loadAiHome({ background: true, selectedDays: Number(days) || 14 });
                  }}
                  disabled={refreshing}
                >
                  {t("ai.anomalies.scan", "Scan")}
                </Button>
              </div>
            </summary>
            <div className="space-y-4 border-t border-[var(--border)] px-6 py-6">
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4 text-sm text-[var(--muted)]">
                {anomalies?.summary || t("ai.anomalies.summary_empty", "Run the scan to load anomaly insight.")}
              </div>
              {anomalies?.items?.length ? (
                <div className="space-y-3">
                  {anomalies.items.map((item) => (
                    <div key={`${item.entry_id}-${item.anomaly_type}`} className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-semibold">
                          {item.anomaly_type.replaceAll("_", " ")} - {item.shift} - {item.date}
                        </div>
                        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-caption text-[var(--muted)]">
                          {item.severity}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-[var(--muted)]">{item.message}</div>
                      <div className="mt-2 text-xs text-[var(--muted)]">
                        {t("ai.anomalies.value_line", "Value {{value}} - baseline {{baseline}}", {
                          value: item.value.toFixed(1),
                          baseline: item.baseline.toFixed(1),
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4 text-sm text-[var(--muted)]">
                  {t("ai.anomalies.empty", "No anomaly cards are loaded yet.")}
                </div>
              )}
            </div>
          </details>
        </section>

        {/* Health Score Trend Chart */}
        <section>
          <HealthTrendChart
            data={healthTrend?.trend || []}
            loading={pageLoading || refreshing}
          />
        </section>

        {status ? <div className="text-sm text-emerald-300">{status}</div> : null}
        {error || sessionError ? <div className="text-sm text-red-300">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
