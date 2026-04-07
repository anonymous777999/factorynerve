"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import { getQuotaHealth, quotaLabel } from "@/lib/quota-health";
import { useSession } from "@/lib/use-session";

const AUTO_REFRESH_MS = 45_000;

type SavedPreset = {
  id: string;
  label: string;
  question: string;
};

const BUILT_IN_PRESETS: SavedPreset[] = [
  {
    id: "downtime-shift",
    label: "Downtime by Shift",
    question: "Show me last month's downtime by shift",
  },
  {
    id: "performance-day",
    label: "Performance by Day",
    question: "Show me this month's performance by day",
  },
  {
    id: "output-total",
    label: "Output Snapshot",
    question: "Show me last 7 days output total",
  },
  {
    id: "manpower-shift",
    label: "Manpower by Shift",
    question: "Show me last 14 days manpower by shift",
  },
];

function presetStorageKey(userId?: number) {
  return `dpr-ai-nlq-presets:${userId || "anon"}`;
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

export default function AiInsightsPage() {
  const { user, loading, error: sessionError } = useSession();
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyResponse | null>(null);
  const [question, setQuestion] = useState("Show me last month's downtime by shift");
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
        setError("Could not load AI insights.");
      }
    } finally {
      setLastUpdatedAt(new Date().toISOString());
      setHasLoadedOnce(true);
      setPageLoading(false);
      setRefreshing(false);
    }
  }, [days, hasLoadedOnce]);

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

  const combinedPresets = useMemo(() => {
    return [...BUILT_IN_PRESETS, ...savedPresets];
  }, [savedPresets]);

  const handleQuestion = async () => {
    setQueryBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await askNaturalLanguageQuery(question);
      setNlqResult(response);
      setStatus(`NLQ answered with ${response.provider}.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not answer the question.");
      }
    } finally {
      setQueryBusy(false);
    }
  };

  const handleSavePreset = () => {
    setSavingPreset(true);
    const label = presetName.trim() || `Preset ${savedPresets.length + 1}`;
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError("Enter a question before saving a preset.");
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
    setStatus(`Saved preset "${label}".`);
    setError("");
    setSavingPreset(false);
  };

  const handleDeletePreset = (presetId: string) => {
    const next = savedPresets.filter((item) => item.id !== presetId);
    savePresets(next);
    setStatus("Saved preset removed.");
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
            <CardTitle>AI Insights</CardTitle>
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

  return (
    <main className="min-h-screen px-4 py-6 pb-24 md:px-8 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">AI Insights</div>
            <h1 className="mt-2 text-3xl font-semibold">Smart suggestions, anomalies, and natural language answers</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              This is the Phase 7 command layer: use your plan-gated AI quota carefully, see anomaly scans, and ask KPI questions without leaving the app.
            </p>
          </div>
          <div className="space-y-3">
            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <Link href="/entry">
                <Button className="w-full sm:w-auto">Open DPR Entry</Button>
              </Link>
              <Link href="/reports">
                <Button variant="outline" className="w-full sm:w-auto">Open Reports</Button>
              </Link>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  void loadAiHome({ background: true, selectedDays: Number(days) || 14 });
                }}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh AI"}
              </Button>
            </div>
            <div className="text-xs text-[var(--muted)]">
              {refreshing
                ? "Updating AI quota and anomaly scan..."
                : lastUpdatedAt
                  ? `Updated ${formatDateTime(lastUpdatedAt)}`
                  : "Live updates every 45 seconds"}
            </div>
          </div>
          </div>
        </section>

        {refreshing ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            Refreshing AI insights in the background...
          </div>
        ) : null}
        {status ? (
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/12 px-4 py-3 text-sm text-emerald-100">
            {status}
          </div>
        ) : null}
        {error || sessionError ? (
          <div className="rounded-3xl border border-rose-400/30 bg-rose-400/12 px-4 py-3 text-sm text-rose-100">
            {error || sessionError}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-[var(--muted)]">Summary Quota</div>
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
                <div
                  className={`h-2 rounded-full ${summaryHealth.barClass}`}
                  style={{ width: `${summaryHealth.percent}%` }}
                />
              </div>
              <div>Used by anomaly scans, NLQ, and executive summaries.</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-[var(--muted)]">Smart Quota</div>
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
                <div
                  className={`h-2 rounded-full ${smartHealth.barClass}`}
                  style={{ width: `${smartHealth.percent}%` }}
                />
              </div>
              <div>Used by smart input and DPR suggestions from history.</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Current Plan</div>
              <CardTitle className="capitalize">{usage?.plan || "-"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              NLQ starts at {usage?.nlq_min_plan || "-"}, anomalies at {usage?.anomaly_min_plan || "-"}.
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm text-[var(--muted)]">Anomaly Alerts</div>
                <CardTitle className="text-xl">Operational drift scanner</CardTitle>
              </div>
              <div className="grid gap-3 sm:flex sm:items-center">
                <select
                  className="w-full rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm sm:w-auto"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                >
                  <option value="7">Last 7 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="30">Last 30 days</option>
                </select>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    void loadAiHome({ background: true, selectedDays: Number(days) || 14 });
                  }}
                  disabled={refreshing}
                >
                  Scan
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4 text-sm text-[var(--muted)]">
                {anomalies?.summary || "Run the scan to load anomaly insight."}
              </div>
              {anomalies?.items?.length ? (
                <div className="space-y-3">
                  {anomalies.items.map((item) => (
                    <div key={`${item.entry_id}-${item.anomaly_type}`} className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="font-semibold">
                          {item.anomaly_type.replaceAll("_", " ")} - {item.shift} - {item.date}
                        </div>
                        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                          {item.severity}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-[var(--muted)]">{item.message}</div>
                      <div className="mt-2 text-xs text-[var(--muted)]">
                        Value {item.value.toFixed(1)} - baseline {item.baseline.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4 text-sm text-[var(--muted)]">
                  No anomaly cards are loaded yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Natural Language Query</div>
              <CardTitle className="text-xl">Ask a factory question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Prompt presets</div>
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
                            Delete
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Input
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                    placeholder="Optional preset label"
                  />
                  <Button variant="outline" className="w-full sm:w-auto" onClick={handleSavePreset} disabled={savingPreset}>
                    {savingPreset ? "Saving..." : "Save Current Prompt"}
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Question</label>
                <Input value={question} onChange={(event) => setQuestion(event.target.value)} />
              </div>
              <div className="grid gap-3 sm:flex sm:flex-wrap">
                <Button className="w-full sm:w-auto" onClick={handleQuestion} disabled={queryBusy}>
                  {queryBusy ? "Thinking..." : "Run Query"}
                </Button>
                <Button className="w-full sm:w-auto" variant="outline" onClick={() => setQuestion(BUILT_IN_PRESETS[1].question)}>
                  Load Example
                </Button>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Answer</div>
                <div className="mt-3 text-sm leading-6 text-[var(--text)]">
                  {nlqResult?.answer || "Run a query to see the answer here."}
                </div>
                {nlqResult ? (
                  <div className="mt-4 space-y-2 text-xs text-[var(--muted)]">
                    <div>Provider: {nlqResult.provider}</div>
                    <div>Generated: {formatDateTime(nlqResult.generated_at)}</div>
                    <div>Query shape: {JSON.stringify(nlqResult.structured_query)}</div>
                  </div>
                ) : null}
              </div>
              {nlqResult?.data_points?.length ? (
                <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Data Points</div>
                  {nlqResult.data_points.map((item) => (
                    <div key={item.group} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="text-[var(--muted)]">{item.group}</span>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
