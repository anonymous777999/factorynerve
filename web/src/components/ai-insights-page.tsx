"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  type AiUsage,
  type AnomalyResponse,
  type NaturalLanguageQueryResponse,
} from "@/lib/ai";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { getQuotaHealth, quotaLabel } from "@/lib/quota-health";
import { useSession } from "@/lib/use-session";

const AUTO_REFRESH_MS = 45_000;

type SavedPreset = {
  id: string;
  label: string;
  question: string;
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
  const builtInPresets = useMemo<SavedPreset[]>(() => [
    {
      id: "downtime-shift",
      label: t("ai.preset.downtime_shift.label", "Downtime by Shift"),
      question: t("ai.preset.downtime_shift.question", "Show me last month's downtime by shift"),
    },
    {
      id: "performance-day",
      label: t("ai.preset.performance_day.label", "Performance by Day"),
      question: t("ai.preset.performance_day.question", "Show me this month's performance by day"),
    },
    {
      id: "output-total",
      label: t("ai.preset.output_total.label", "Output Snapshot"),
      question: t("ai.preset.output_total.question", "Show me last 7 days output total"),
    },
    {
      id: "manpower-shift",
      label: t("ai.preset.manpower_shift.label", "Manpower by Shift"),
      question: t("ai.preset.manpower_shift.question", "Show me last 14 days manpower by shift"),
    },
  ], [t]);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyResponse | null>(null);
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
  const summaryHealth = getQuotaHealth(usage?.summary_used, usage?.summary_limit);
  const smartHealth = getQuotaHealth(usage?.smart_used, usage?.smart_limit);

  useEffect(() => {
    if (!question) {
      setQuestion(t("ai.preset.downtime_shift.question", "Show me last month's downtime by shift"));
    }
  }, [question, t]);

  const loadAiHome = useCallback(async (options?: { background?: boolean; selectedDays?: number }) => {
    const selectedDays = options?.selectedDays ?? (Number(days) || 14);
    const shouldBackground = Boolean(options?.background) && hasLoadedOnce;
    if (shouldBackground) {
      setRefreshing(true);
    } else {
      setPageLoading(true);
    }
    setError("");
    try {
      const [usageResult, anomalyResult] = await Promise.all([getAiUsage(), getAnomalies(selectedDays)]);
      setUsage(usageResult);
      setAnomalies(anomalyResult);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("ai.errors.load", "Could not load AI insights."));
      }
    } finally {
      setLastUpdatedAt(new Date().toISOString());
      setHasLoadedOnce(true);
      setPageLoading(false);
      setRefreshing(false);
    }
  }, [days, hasLoadedOnce, t]);

  useEffect(() => {
    setError("");
    setStatus("");
    setLastUpdatedAt(null);
    setHasLoadedOnce(false);
    if (!user) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    void loadAiHome();
  }, [loadAiHome, user]);

  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      if (!document.hidden) {
        void loadAiHome({ background: true });
      }
    };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
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
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">{t("ai.title", "AI Insights")}</div>
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
                    : t("ai.hero.live_updates", "Live updates every 45s")}
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
              disabled={refreshing}
            >
              {refreshing ? t("ai.actions.refreshing", "Refreshing...") : t("common.refresh", "Refresh")}
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

        {refreshing ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            {t("ai.refreshing_background", "Refreshing AI insights in the background...")}
          </div>
        ) : null}

        <details className="group rounded-[2rem] border border-[var(--border)] bg-[rgba(18,22,34,0.92)] shadow-xl">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-6 py-5">
            <div>
              <div className="text-sm text-[var(--muted)]">{t("ai.quota.title", "Plan and quota")}</div>
              <div className="mt-1 text-xl font-semibold text-[var(--text)]">{t("ai.quota.subtitle", "Usage context")}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${summaryHealth.badgeClass}`}>{summaryHealth.badge}</span>
              <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${smartHealth.badgeClass}`}>{smartHealth.badge}</span>
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
                  <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${summaryHealth.badgeClass}`}>
                    {summaryHealth.badge}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[var(--muted)]">
                <div className="text-xs uppercase tracking-[0.18em] text-white/80">{summaryHealth.detail}</div>
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
                  <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${smartHealth.badgeClass}`}>
                    {smartHealth.badge}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[var(--muted)]">
                <div className="text-xs uppercase tracking-[0.18em] text-white/80">{smartHealth.detail}</div>
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
                <Button variant="outline" onClick={() => setQuestion(builtInPresets[1]?.question || "")}>
                  {t("ai.query.example", "Example")}
                </Button>
              </div>
              <details className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)]">
                <summary className="cursor-pointer list-none px-4 py-4 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("ai.query.presets", "Prompt presets")}
                </summary>
                <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    {combinedPresets.map((preset) => {
                      const isCustom = savedPresets.some((item) => item.id === preset.id);
                      return (
                        <div key={preset.id} className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold transition hover:border-[rgba(62,166,255,0.4)] hover:text-white"
                            onClick={() => setQuestion(preset.question)}
                          >
                            {preset.label}
                          </button>
                          {isCustom ? (
                            <button
                              type="button"
                              className="text-xs text-[var(--muted)] underline underline-offset-4"
                              onClick={() => handleDeletePreset(preset.id)}
                            >
                              {t("ai.query.delete", "Delete")}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <Input
                      value={presetName}
                      onChange={(event) => setPresetName(event.target.value)}
                      placeholder={t("ai.query.preset_placeholder", "Optional preset label")}
                    />
                    <Button variant="outline" onClick={handleSavePreset} disabled={savingPreset}>
                      {savingPreset ? t("ai.query.saving", "Saving...") : t("ai.query.save_preset", "Save preset")}
                    </Button>
                  </div>
                </div>
              </details>
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{t("ai.query.answer", "Answer")}</div>
                <div className="mt-3 text-sm leading-6 text-[var(--text)]">
                  {nlqResult?.answer || t("ai.query.answer_empty", "Run a query to see the answer here.")}
                </div>
                {nlqResult ? (
                  <details className="mt-4 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
                    <summary className="cursor-pointer list-none px-3 py-3 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
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
                  <summary className="cursor-pointer list-none px-4 py-4 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
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
                        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
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

        {status ? <div className="text-sm text-emerald-300">{status}</div> : null}
        {error || sessionError ? <div className="text-sm text-red-300">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
