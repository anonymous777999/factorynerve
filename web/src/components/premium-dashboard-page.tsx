"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { getOcrVerificationSummary, type OcrVerificationSummary } from "@/lib/ocr";
import {
  downloadPremiumExecutivePdf,
  getPremiumAuditTrail,
  getPremiumDashboard,
  type PremiumAuditItem,
  type PremiumDashboardResponse,
  type PremiumSeriesPoint,
  type PremiumSummary,
} from "@/lib/premium";
import { triggerBlobDownload } from "@/lib/reports";
import { getSteelOverview, type SteelOverview } from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

type DerivedFactoryStat = {
  factoryId: string;
  factoryName: string;
  units: number;
  target: number;
  performance: number;
  downtime: number;
};

type DerivedShiftStat = {
  shift: string;
  units: number;
  target: number;
  performance: number;
  downtime: number;
  issues: number;
};

type DerivedTimelinePoint = {
  date: string;
  units: number;
  target: number;
  performance: number;
  downtime: number;
};

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function formatDateTime(value: string) {
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

function shiftLabel(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : "-";
}

function levelClasses(level: number) {
  switch (level) {
    case 4:
      return "bg-[rgba(220,38,38,0.95)]";
    case 3:
      return "bg-[rgba(245,158,11,0.92)]";
    case 2:
      return "bg-[rgba(34,197,94,0.75)]";
    case 1:
      return "bg-[rgba(62,166,255,0.55)]";
    default:
      return "bg-[rgba(255,255,255,0.06)]";
  }
}

function formatCurrency(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "Restricted";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value?: number | null) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatKg(value?: number | null) {
  return `${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} KG`;
}

function severityClasses(severity: "normal" | "watch" | "high" | "critical") {
  switch (severity) {
    case "critical":
      return "border-red-400/35 bg-[rgba(239,68,68,0.12)] text-red-100";
    case "high":
      return "border-amber-400/35 bg-[rgba(245,158,11,0.12)] text-amber-100";
    case "watch":
      return "border-cyan-400/35 bg-[rgba(34,211,238,0.12)] text-cyan-100";
    default:
      return "border-emerald-400/35 bg-[rgba(34,197,94,0.12)] text-emerald-100";
  }
}

function computeSummary(series: PremiumSeriesPoint[]): PremiumSummary {
  const totalUnits = series.reduce((sum, point) => sum + point.units, 0);
  const totalTarget = series.reduce((sum, point) => sum + point.target, 0);
  const totalDowntime = series.reduce((sum, point) => sum + point.downtime, 0);
  const issuesCount = series.reduce((sum, point) => sum + point.issues, 0);
  const factoryIds = new Set(series.map((point) => point.factory_id));
  const averagePerformance =
    series.length > 0 ? series.reduce((sum, point) => sum + point.performance, 0) / series.length : 0;

  return {
    total_units: totalUnits,
    total_target: totalTarget,
    average_performance: averagePerformance,
    total_downtime: totalDowntime,
    issues_count: issuesCount,
    active_factories: factoryIds.size,
    active_people: 0,
  };
}

function TimelineChart({ points }: { points: DerivedTimelinePoint[] }) {
  if (!points.length) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--muted)]">
        No timeline data matches the current premium filters.
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const padding = 24;
  const maxUnits = Math.max(...points.map((point) => point.units), 1);
  const maxPerf = Math.max(...points.map((point) => point.performance), 1);

  const unitPath = points
    .map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(1, points.length - 1);
      const y = height - padding - (point.units / maxUnits) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const perfPath = points
    .map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(1, points.length - 1);
      const y = height - padding - (point.performance / maxPerf) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible rounded-3xl border border-[var(--border)] bg-[rgba(10,14,22,0.8)] p-2">
        {Array.from({ length: 4 }).map((_, index) => {
          const y = padding + (index * (height - padding * 2)) / 3;
          return (
            <line
              key={y}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 6"
            />
          );
        })}
        <path d={unitPath} fill="none" stroke="#3EA6FF" strokeWidth="4" strokeLinecap="round" />
        <path d={perfPath} fill="none" stroke="#2DD4BF" strokeWidth="3" strokeLinecap="round" />
        {points.map((point, index) => {
          const x = padding + (index * (width - padding * 2)) / Math.max(1, points.length - 1);
          const unitY = height - padding - (point.units / maxUnits) * (height - padding * 2);
          return (
            <g key={point.date}>
              <circle cx={x} cy={unitY} r="4" fill="#3EA6FF" />
            </g>
          );
        })}
      </svg>
      <div className="grid grid-cols-2 gap-3 text-xs text-[var(--muted)] md:grid-cols-4">
        {points.slice(-4).map((point) => (
          <div key={point.date} className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-3">
            <div>{formatDate(point.date)}</div>
            <div className="mt-1 text-sm font-semibold text-[var(--text)]">{point.units} units</div>
            <div>{point.performance.toFixed(1)}% perf</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FactoryChart({
  items,
  selectedFactoryId,
  onSelect,
}: {
  items: DerivedFactoryStat[];
  selectedFactoryId: string | null;
  onSelect: (factoryId: string | null) => void;
}) {
  const maxUnits = Math.max(...items.map((item) => item.units), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const active = selectedFactoryId === item.factoryId;
        const width = Math.max(6, Math.round((item.units / maxUnits) * 100));
        return (
          <button
            key={item.factoryId}
            type="button"
            onClick={() => onSelect(active ? null : item.factoryId)}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              active
                ? "border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.14)]"
                : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(62,166,255,0.25)]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">{item.factoryName}</div>
                <div className="text-xs text-[var(--muted)]">
                  {item.units} / {item.target} units - {item.performance.toFixed(1)}% performance
                </div>
              </div>
              <div className="text-xs text-[var(--muted)]">{item.downtime} min downtime</div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
              <div className="h-2 rounded-full bg-[linear-gradient(90deg,#3EA6FF,#2DD4BF)]" style={{ width: `${width}%` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ShiftChart({
  items,
  selectedShift,
  onSelect,
}: {
  items: DerivedShiftStat[];
  selectedShift: string | null;
  onSelect: (shift: string | null) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => {
        const active = selectedShift === item.shift;
        return (
          <button
            key={item.shift}
            type="button"
            onClick={() => onSelect(active ? null : item.shift)}
            className={`rounded-2xl border p-4 text-left transition ${
              active
                ? "border-[rgba(45,212,191,0.45)] bg-[rgba(45,212,191,0.14)]"
                : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(45,212,191,0.28)]"
            }`}
          >
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{shiftLabel(item.shift)}</div>
            <div className="mt-3 text-2xl font-semibold text-[var(--text)]">{item.performance.toFixed(1)}%</div>
            <div className="mt-1 text-sm text-[var(--muted)]">{item.units} units - {item.downtime} min downtime</div>
            <div className="mt-3 h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
              <div
                className="h-2 rounded-full bg-[linear-gradient(90deg,#2DD4BF,#84CC16)]"
                style={{ width: `${Math.max(5, Math.min(100, item.performance))}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function PremiumDashboardPage() {
  const { user, loading, error: sessionError, activeFactory } = useSession();
  const [dashboard, setDashboard] = useState<PremiumDashboardResponse | null>(null);
  const [auditTrail, setAuditTrail] = useState<PremiumAuditItem[]>([]);
  const [ocrSummary, setOcrSummary] = useState<OcrVerificationSummary | null>(null);
  const [steelOverview, setSteelOverview] = useState<SteelOverview | null>(null);
  const [days, setDays] = useState(14);
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const [auditAction, setAuditAction] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState("");
  const [error, setError] = useState("");
  const [auditWarning, setAuditWarning] = useState("");
  const [ocrWarning, setOcrWarning] = useState("");
  const [steelWarning, setSteelWarning] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      setBusy(true);
      setError("");
      setLocked("");
      setAuditWarning("");
      setOcrWarning("");
      setSteelWarning("");
    });
    Promise.allSettled([
      getPremiumDashboard({ days }),
      getPremiumAuditTrail({ days, limit: 80, action: auditAction || undefined }),
      getOcrVerificationSummary(),
    ])
      .then(([dashboardResult, auditResult, ocrResult]) => {
        if (!alive) return;
        if (dashboardResult.status === "fulfilled") {
          setDashboard(dashboardResult.value);
        } else {
          const err = dashboardResult.reason;
          if (err instanceof ApiError && err.status === 402) {
            setLocked(err.message);
            setDashboard(null);
            setAuditTrail([]);
            return;
          }
          setError(err instanceof Error ? err.message : "Could not load premium analytics.");
          setDashboard(null);
        }

        if (auditResult.status === "fulfilled") {
          setAuditTrail(auditResult.value?.items ?? []);
        } else {
          const err = auditResult.reason;
          setAuditTrail([]);
          setAuditWarning(
            err instanceof Error
              ? `Audit trail is temporarily unavailable: ${err.message}`
              : "Audit trail is temporarily unavailable."
          );
        }

        if (ocrResult.status === "fulfilled") {
          setOcrSummary(ocrResult.value);
        } else {
          const err = ocrResult.reason;
          setOcrSummary(null);
          setOcrWarning(
            err instanceof Error
              ? `OCR trust summary is temporarily unavailable: ${err.message}`
              : "OCR trust summary is temporarily unavailable.",
          );
        }
      })
      .finally(() => {
        if (alive) {
          setBusy(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [auditAction, days, user]);

  useEffect(() => {
    const steelMode = (activeFactory?.industry_type || "").toLowerCase() === "steel";
    if (!user || !dashboard || locked || !steelMode) {
      return;
    }
    let alive = true;
    getSteelOverview()
      .then((nextOverview) => {
        if (alive) {
          setSteelWarning("");
          setSteelOverview(nextOverview);
        }
      })
      .catch((reason) => {
        if (!alive) return;
        setSteelOverview(null);
        setSteelWarning(
          reason instanceof Error
            ? `Owner steel risk desk is temporarily unavailable: ${reason.message}`
            : "Owner steel risk desk is temporarily unavailable.",
        );
      });

    return () => {
      alive = false;
    };
  }, [activeFactory?.factory_id, activeFactory?.industry_type, dashboard, locked, user]);

  const filteredSeries = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.series.filter((point) => {
      if (selectedFactoryId && point.factory_id !== selectedFactoryId) return false;
      if (selectedShift && point.shift !== selectedShift) return false;
      return true;
    });
  }, [dashboard, selectedFactoryId, selectedShift]);

  const derivedSummary = useMemo(() => {
    if (!dashboard) return null;
    const computed = computeSummary(filteredSeries);
    return {
      ...computed,
      active_people: dashboard.summary.active_people,
    };
  }, [dashboard, filteredSeries]);

  const factoryStats = useMemo<DerivedFactoryStat[]>(() => {
    const map = new Map<string, DerivedFactoryStat>();
    for (const point of dashboard?.series || []) {
      const current = map.get(point.factory_id) || {
        factoryId: point.factory_id,
        factoryName: point.factory_name,
        units: 0,
        target: 0,
        performance: 0,
        downtime: 0,
      };
      current.units += point.units;
      current.target += point.target;
      current.performance += point.performance;
      current.downtime += point.downtime;
      map.set(point.factory_id, current);
    }
    return [...map.values()]
      .map((item) => ({
        ...item,
        performance: item.target > 0 ? (item.units / item.target) * 100 : item.performance,
      }))
      .sort((left, right) => right.units - left.units);
  }, [dashboard]);

  const shiftStats = useMemo<DerivedShiftStat[]>(() => {
    const map = new Map<string, DerivedShiftStat>();
    for (const point of filteredSeries) {
      const current = map.get(point.shift) || {
        shift: point.shift,
        units: 0,
        target: 0,
        performance: 0,
        downtime: 0,
        issues: 0,
      };
      current.units += point.units;
      current.target += point.target;
      current.performance += point.performance;
      current.downtime += point.downtime;
      current.issues += point.issues;
      map.set(point.shift, current);
    }
    return ["morning", "evening", "night"].map((shift) => {
      const item = map.get(shift) || {
        shift,
        units: 0,
        target: 0,
        performance: 0,
        downtime: 0,
        issues: 0,
      };
      return {
        ...item,
        performance: item.target > 0 ? (item.units / item.target) * 100 : 0,
      };
    });
  }, [filteredSeries]);

  const timeline = useMemo<DerivedTimelinePoint[]>(() => {
    const map = new Map<string, DerivedTimelinePoint>();
    for (const point of filteredSeries) {
      const current = map.get(point.date) || {
        date: point.date,
        units: 0,
        target: 0,
        performance: 0,
        downtime: 0,
      };
      current.units += point.units;
      current.target += point.target;
      current.performance += point.performance;
      current.downtime += point.downtime;
      map.set(point.date, current);
    }
    return [...map.values()]
      .map((item) => ({
        ...item,
        performance: item.target > 0 ? (item.units / item.target) * 100 : 0,
      }))
      .sort((left, right) => left.date.localeCompare(right.date));
  }, [filteredSeries]);

  const filteredAudit = useMemo(() => {
    return auditTrail.filter((item) => {
      if (selectedFactoryId && item.factory_id !== selectedFactoryId) return false;
      return true;
    });
  }, [auditTrail, selectedFactoryId]);

  const auditActions = useMemo(() => {
    return [...new Set((auditTrail || []).map((item) => item.action))].sort();
  }, [auditTrail]);

  const handleExportPdf = async () => {
    setStatus("");
    setError("");
    try {
      const blob = await downloadPremiumExecutivePdf({
        days,
        factoryId: selectedFactoryId,
        shift: selectedShift,
      });
      triggerBlobDownload(blob, `premium-analytics-${days}d.pdf`);
      setStatus("Executive PDF export started.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export executive PDF.");
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">Loading premium analytics...</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Premium Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please sign in to continue."}</div>
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (user.role === "operator" || user.role === "accountant" || user.role === "attendance") {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Premium Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">
              Premium analytics are available to supervisors, managers, admins, and owners on Factory or Enterprise plans.
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard">
                <Button>Back to Dashboard</Button>
              </Link>
              <Link href="/plans">
                <Button variant="outline">See Plans</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const activeSummary = derivedSummary || dashboard?.summary;
  const steelMode = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const steelLayerVisible = Boolean(steelOverview) && steelMode && (!selectedFactoryId || selectedFactoryId === activeFactory?.factory_id);
  const selectedFactoryMismatch = Boolean(steelOverview) && steelMode && Boolean(selectedFactoryId) && selectedFactoryId !== activeFactory?.factory_id;
  const topRankedAnomalies = steelOverview?.ranked_anomalies.slice(0, 3) || [];
  const topOperatorSignals = steelOverview?.responsibility_analytics.by_operator.slice(0, 3) || [];
  const topDaySignals = steelOverview?.responsibility_analytics.by_day.slice(0, 3) || [];
  const topBatchSignals = steelOverview?.responsibility_analytics.by_batch.slice(0, 3) || [];
  const stockTrustHotspots = steelOverview?.low_confidence_items.slice(0, 3) || [];
  const ownerRiskCards = steelOverview
    ? [
        {
          label: "Money at risk",
          value: steelOverview.financial_access
            ? formatCurrency(steelOverview.anomaly_summary.total_estimated_leakage_value_inr)
            : "Restricted",
          helper: `Estimated leakage from ${steelOverview.anomaly_summary.ranked_batch_count} ranked anomaly batch${steelOverview.anomaly_summary.ranked_batch_count === 1 ? "" : "es"}.`,
          tone: "border-red-400/30 bg-[rgba(239,68,68,0.12)]",
          href: "/steel?tab=risk",
          action: "Open Risk Review",
        },
        {
          label: "Stock trust",
          value: `${Number(steelOverview.confidence_counts.red || 0)} red / ${Number(steelOverview.confidence_counts.yellow || 0)} watch`,
          helper: `${stockTrustHotspots.length} low-confidence stock hotspot${stockTrustHotspots.length === 1 ? "" : "s"} need owner attention.`,
          tone: "border-amber-400/30 bg-[rgba(245,158,11,0.12)]",
          href: "/steel/reconciliations",
          action: "Open Stock Review",
        },
        {
          label: "Dispatch exposure",
          value: steelOverview.financial_access
            ? formatCurrency(steelOverview.profit_summary?.outstanding_invoice_amount_inr)
            : "Restricted",
          helper: `${formatKg(steelOverview.profit_summary?.outstanding_invoice_weight_kg)} still not realized from invoices already raised.`,
          tone: "border-sky-400/30 bg-[rgba(56,189,248,0.12)]",
          href: "/steel/dispatches",
          action: "Open Dispatch",
        },
        {
          label: "Repeated anomalies",
          value: `${Number(steelOverview.anomaly_summary.high_batches || 0) + Number(steelOverview.anomaly_summary.critical_batches || 0)} batch signals`,
          helper: `Highest anomaly score ${Number(steelOverview.anomaly_summary.highest_anomaly_score || 0).toFixed(1)} across current steel data.`,
          tone: "border-fuchsia-400/30 bg-[rgba(217,70,239,0.12)]",
          href: "/steel/charts",
          action: "Open Steel Charts",
        },
        {
          label: "Top responsibility signal",
          value:
            steelOverview.anomaly_summary.highest_risk_operator?.name ||
            steelOverview.anomaly_summary.highest_loss_day?.date ||
            "No repeated risk yet",
          helper: steelOverview.anomaly_summary.highest_risk_operator
            ? `${steelOverview.anomaly_summary.highest_risk_operator.high_risk_batches} high-risk batch${steelOverview.anomaly_summary.highest_risk_operator.high_risk_batches === 1 ? "" : "es"} linked to the top operator signal.`
            : "Responsibility analytics will sharpen as more approved steel data flows in.",
          tone: "border-emerald-400/30 bg-[rgba(34,197,94,0.12)]",
          href: "/reports",
          action: "Open Reports",
        },
      ]
    : [];

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-[2rem] border border-[rgba(62,166,255,0.18)] bg-[radial-gradient(circle_at_top_left,rgba(62,166,255,0.18),rgba(11,14,20,0.92)_50%)] p-6 shadow-[0_40px_120px_rgba(3,8,20,0.45)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.32em] text-[rgba(62,166,255,0.88)]">
                Owner Intelligence
              </div>
              <h1 className="text-3xl font-semibold text-[var(--text)]">Read the owner signals before you jump into a desk</h1>
              <p className="max-w-4xl text-sm leading-6 text-[var(--muted)]">
                Start with money at risk, trust gaps, and responsibility signals, then open the exact workflow that needs attention.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void handleExportPdf()}>
                Executive PDF
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-full border border-[rgba(45,212,191,0.34)] bg-[rgba(45,212,191,0.14)] px-4 py-2 text-[var(--text)]">
              Tier: {dashboard?.plan?.toUpperCase() || "PREMIUM"}
            </span>
            {dashboard?.enterprise_mode ? (
              <span className="rounded-full border border-[rgba(250,204,21,0.34)] bg-[rgba(250,204,21,0.12)] px-4 py-2 text-[var(--text)]">
                Enterprise mode active
              </span>
            ) : (
              <span className="rounded-full border border-[rgba(62,166,255,0.25)] bg-[rgba(62,166,255,0.1)] px-4 py-2 text-[var(--text)]">
                Factory premium surface
              </span>
            )}
            <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-[var(--muted)]">
              Generated: {dashboard ? formatDateTime(dashboard.generated_at) : "-"}
            </span>
            {steelMode ? (
              <span className="rounded-full border border-red-400/30 bg-[rgba(239,68,68,0.1)] px-4 py-2 text-[var(--text)]">
                Steel owner layer active
              </span>
            ) : null}
            {ocrSummary ? (
              <span className="rounded-full border border-cyan-400/30 bg-[rgba(34,211,238,0.1)] px-4 py-2 text-[var(--text)]">
                Trusted OCR: {ocrSummary.trusted_documents} docs
              </span>
            ) : null}
          </div>
        </section>

        {/* AUDIT: BUTTON_CLUTTER - keep route jumps in a secondary tray so the owner signal board stays primary. */}
        <details className="rounded-[28px] border border-[var(--border)] bg-[rgba(12,16,24,0.72)] p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)] marker:hidden">
            Owner tools
          </summary>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/analytics">
              <Button variant="outline">Analytics</Button>
            </Link>
            <Link href="/dashboard">
              <Button>Board</Button>
            </Link>
          </div>
        </details>

        {/* AUDIT: FLOW_BROKEN - add a short owner sequence so the page frames the next decision clearly. */}
        <section className="grid gap-3 md:grid-cols-3">
          {[
            { step: "1. Read risk", caption: "Start with premium signals, not raw route switching." },
            { step: "2. Focus scope", caption: "Use linked filters to narrow the factory and shift context." },
            { step: "3. Open desk", caption: "Jump into steel, reports, or OCR only after the pattern is clear." },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-[24px] border border-[var(--border)] bg-[rgba(10,14,24,0.68)] px-5 py-4"
            >
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">{item.step}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{item.caption}</div>
            </div>
          ))}
        </section>

        <Card>
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-xl">Linked Filters</CardTitle>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Select one chart dimension and the rest of the command center updates with the same scope.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Window</div>
                <Select value={String(days)} onChange={(event) => setDays(Number(event.target.value))}>
                  <option value="7">Last 7 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="30">Last 30 days</option>
                </Select>
              </div>
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Factory</div>
                <Select value={selectedFactoryId || ""} onChange={(event) => setSelectedFactoryId(event.target.value || null)}>
                  <option value="">All factories</option>
                  {(dashboard?.filters.factories || []).map((factory) => (
                    <option key={factory.id} value={factory.id}>
                      {factory.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Shift</div>
                <Select value={selectedShift || ""} onChange={(event) => setSelectedShift(event.target.value || null)}>
                  <option value="">All shifts</option>
                  {(dashboard?.filters.shifts || []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Audit Action</div>
                <Select value={auditAction} onChange={(event) => setAuditAction(event.target.value)}>
                  <option value="">All actions</option>
                  {auditActions.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
        </Card>

        {locked ? (
          <Card>
            <CardHeader>
              <CardTitle>Owner Intelligence Plan Gate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-[var(--muted)]">{locked}</div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  "Money-at-risk cards with INR exposure",
                  "Leakage evidence linked to batch and stock pages",
                  "Responsibility radar for repeated operator and day signals",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--text)]/85">
                    {item}
                  </div>
                ))}
              </div>
              <Link href="/plans">
                <Button>Upgrade Plan</Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {dashboard && activeSummary ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {[
                ["Output", `${activeSummary.total_units}`],
                ["Target", `${activeSummary.total_target}`],
                ["Performance", `${activeSummary.average_performance.toFixed(1)}%`],
                ["Downtime", `${activeSummary.total_downtime} min`],
                ["Issues", `${activeSummary.issues_count}`],
                ["People", `${activeSummary.active_people}`],
              ].map(([label, value]) => (
                <Card key={label}>
                  <CardHeader>
                    <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{label}</div>
                    <CardTitle className="text-2xl">{value}</CardTitle>
                  </CardHeader>
                </Card>
                ))}
            </section>

            {selectedFactoryMismatch ? (
              <Card className="border-amber-400/30 bg-[rgba(245,158,11,0.08)]">
                <CardContent className="px-5 py-4 text-sm text-amber-100">
                  Owner steel risk cards follow the active factory in the sidebar. Clear the factory filter or switch the active factory if you want the risk desk and premium analytics scope to match exactly.
                </CardContent>
              </Card>
            ) : null}

            {steelLayerVisible ? (
              <section className="space-y-6">
                <Card className="border-[rgba(239,68,68,0.18)] bg-[linear-gradient(135deg,rgba(42,16,16,0.96),rgba(14,20,30,0.92))]">
                  <CardHeader className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.28em] text-red-200">Owner Risk Desk</div>
                    <CardTitle className="text-2xl">Where am I losing money, why, and what should I check first?</CardTitle>
                    <div className="max-w-4xl text-sm leading-6 text-[var(--muted)]">
                      This layer turns approved steel operating data into owner action: leakage value, stock confidence, dispatch exposure, repeated anomaly patterns, and responsibility signals tied back to the source workflow.
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 xl:grid-cols-5">
                    {ownerRiskCards.map((card) => (
                      <div key={card.label} className={`rounded-2xl border p-4 ${card.tone}`}>
                        <div className="text-xs uppercase tracking-[0.18em] text-white/75">{card.label}</div>
                        <div className="mt-3 text-2xl font-semibold text-white">{card.value}</div>
                        <div className="mt-2 min-h-[3.5rem] text-sm leading-6 text-white/80">{card.helper}</div>
                        <Link href={card.href}>
                          <Button variant="outline" className="mt-4 w-full">
                            {card.action}
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Why the system flagged this</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {topRankedAnomalies.length ? (
                        topRankedAnomalies.map((entry) => (
                          <div key={entry.batch.id} className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={severityClasses(entry.batch.severity)}>
                                    <span className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
                                      {entry.batch.severity}
                                    </span>
                                  </span>
                                  <span className="rounded-full border border-[var(--border)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                    Score {entry.anomaly_score.toFixed(1)}
                                  </span>
                                </div>
                                <div className="text-lg font-semibold text-[var(--text)]">{entry.batch.batch_code}</div>
                                <div className="text-sm leading-6 text-[var(--text)]/90">{entry.reason}</div>
                              </div>
                              <div className="text-xs text-[var(--muted)]">{formatDate(entry.batch.production_date)}</div>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-4">
                              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Operator</div>
                                <div className="mt-1 text-sm text-[var(--text)]">{entry.batch.operator_name || "Unassigned"}</div>
                              </div>
                              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Loss %</div>
                                <div className="mt-1 text-sm text-[var(--text)]">{formatPercent(entry.batch.loss_percent)}</div>
                              </div>
                              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Variance</div>
                                <div className="mt-1 text-sm text-[var(--text)]">{formatKg(entry.batch.variance_kg)}</div>
                              </div>
                              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Leakage value</div>
                                <div className="mt-1 text-sm text-[var(--text)]">
                                  {steelOverview?.financial_access ? formatCurrency(entry.estimated_leakage_value_inr) : "Restricted"}
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3">
                              <Link href={`/steel/batches/${entry.batch.id}`}>
                                <Button variant="outline">Open Batch Evidence</Button>
                              </Link>
                              <Link href="/steel/reconciliations">
                                <Button variant="ghost">Check Stock Trust</Button>
                              </Link>
                              <Link href="/reports">
                                <Button variant="ghost">Open Reports</Button>
                              </Link>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--muted)]">
                          No anomaly evidence is ranked yet for the active steel factory.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Owner action language</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-2xl border border-red-400/25 bg-[rgba(239,68,68,0.08)] p-4 text-sm leading-6 text-[var(--text)]/90">
                        Start with money at risk, then validate whether the problem is process leakage, stock confidence drift, or dispatch realization delay. This desk is strongest when OCR, stock review, and dispatch records are trusted.
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm leading-6 text-[var(--text)]/90">
                        Demo line:{" "}
                        <span className="font-semibold">
                          &ldquo;This factory currently has{" "}
                          {steelOverview?.financial_access
                            ? formatCurrency(steelOverview?.anomaly_summary.total_estimated_leakage_value_inr)
                            : "restricted financial risk"}{" "}
                          under watch, {Number(steelOverview?.confidence_counts.red || 0)} red stock positions, and{" "}
                          {topOperatorSignals[0]?.name || "no repeated operator signal yet"} as the top responsibility signal.&rdquo;
                        </span>
                      </div>
                      <div className="grid gap-3">
                        <Link href="/steel/charts">
                          <Button className="w-full">Open Steel Charts</Button>
                        </Link>
                        <Link href="/email-summary">
                          <Button variant="outline" className="w-full">Open Weekly Owner Summary</Button>
                        </Link>
                        <Link href="/plans">
                          <Button variant="ghost" className="w-full">Review Premium Packaging</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </section>

                <section className="grid gap-6 xl:grid-cols-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Responsibility by operator</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {topOperatorSignals.length ? (
                        topOperatorSignals.map((item) => (
                          <div key={`operator:${item.user_id}`} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-[var(--text)]">{item.name}</div>
                              <div className="text-xs text-[var(--muted)]">Score {item.highest_anomaly_score.toFixed(1)}</div>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-[var(--muted)]">
                              {item.high_risk_batches} high-risk / {item.critical_batches} critical batches
                            </div>
                            <div className="mt-2 text-sm text-[var(--text)]">
                              {steelOverview?.financial_access ? formatCurrency(item.total_variance_value_inr) : formatKg(item.total_variance_kg)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                          No repeated operator responsibility signal yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Responsibility by day</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {topDaySignals.length ? (
                        topDaySignals.map((item) => (
                          <div key={`day:${item.date}`} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-[var(--text)]">{formatDate(item.date)}</div>
                              <div className="text-xs text-[var(--muted)]">{item.batch_count} batches</div>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-[var(--muted)]">
                              Avg loss {formatPercent(item.average_loss_percent)} | high-risk {item.high_risk_batches}
                            </div>
                            <div className="mt-2 text-sm text-[var(--text)]">
                              {steelOverview?.financial_access ? formatCurrency(item.total_variance_value_inr) : formatKg(item.total_variance_kg)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                          No repeated day-level loss pattern yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Responsibility by batch</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {topBatchSignals.length ? (
                        topBatchSignals.map((item) => (
                          <Link key={`batch:${item.id}`} href={`/steel/batches/${item.id}`} className="block rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 transition hover:border-[rgba(62,166,255,0.3)]">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-[var(--text)]">{item.batch_code}</div>
                              <div className="text-xs text-[var(--muted)]">Score {item.anomaly_score.toFixed(1)}</div>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-[var(--muted)]">
                              {formatDate(item.production_date)} | {formatPercent(item.loss_percent)} loss
                            </div>
                            <div className="mt-2 text-sm text-[var(--text)]">
                              {steelOverview?.financial_access ? formatCurrency(item.variance_value_inr) : formatKg(item.variance_kg)}
                            </div>
                          </Link>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                          No batch-level responsibility ranking yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Stock trust hotspots</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {stockTrustHotspots.length ? (
                        stockTrustHotspots.map((item) => (
                          <div key={`stock:${item.item_id}`} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-[var(--text)]">{item.name}</div>
                              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{item.confidence_status}</div>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-[var(--muted)]">{item.confidence_reason}</div>
                            <div className="mt-2 text-sm text-[var(--text)]">
                              Last variance {item.last_variance_kg == null ? "-" : formatKg(item.last_variance_kg)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                          Stock confidence is green across the current tracked items.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </section>
              </section>
            ) : null}

            {ocrSummary ? (
              <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Trusted OCR Intake</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] p-4">
                        <div className="text-xs uppercase tracking-[0.22em] text-emerald-100/80">Trusted docs</div>
                        <div className="mt-2 text-2xl font-semibold text-emerald-50">{ocrSummary.trusted_documents}</div>
                        <div className="mt-1 text-sm text-emerald-100/85">{ocrSummary.trusted_rows} trusted rows</div>
                      </div>
                      <div className="rounded-2xl border border-amber-400/30 bg-[rgba(245,158,11,0.12)] p-4">
                        <div className="text-xs uppercase tracking-[0.22em] text-amber-100/80">Pending review</div>
                        <div className="mt-2 text-2xl font-semibold text-amber-50">{ocrSummary.pending_documents}</div>
                        <div className="mt-1 text-sm text-amber-100/85">{ocrSummary.pending_rows} rows waiting</div>
                      </div>
                      <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] p-4">
                        <div className="text-xs uppercase tracking-[0.22em] text-red-100/80">Untrusted docs</div>
                        <div className="mt-2 text-2xl font-semibold text-red-50">{ocrSummary.untrusted_documents}</div>
                        <div className="mt-1 text-sm text-red-100/85">{ocrSummary.untrusted_rows} rows outside trusted reporting</div>
                      </div>
                      <div className="rounded-2xl border border-cyan-400/30 bg-[rgba(34,211,238,0.12)] p-4">
                        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/80">Approval rate</div>
                        <div className="mt-2 text-2xl font-semibold text-cyan-50">
                          {(ocrSummary.approval_rate ?? 0).toFixed(0)}%
                        </div>
                        <div className="mt-1 text-sm text-cyan-100/85">
                          Last trusted: {ocrSummary.last_trusted_at ? formatDateTime(ocrSummary.last_trusted_at) : "-"}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[rgba(62,166,255,0.2)] bg-[rgba(62,166,255,0.08)] p-4 text-sm leading-6 text-[var(--text)]/90">
                      {ocrSummary.trust_note}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Owner OCR Signal</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm leading-6 text-[var(--text)]/90">
                      Only approved OCR documents should feed owner reporting, anomaly scans, and premium summaries. Pending and rejected documents stay visible here so the trust gap is obvious before money decisions are made.
                    </div>
                    <div className="grid gap-3">
                      <Link href="/ocr/verify">
                        <Button className="w-full">Open Review Documents</Button>
                      </Link>
                      <Link href="/reports">
                        <Button variant="outline" className="w-full">Open Reports & Exports</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </section>
            ) : null}

            <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Production Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <TimelineChart points={timeline} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Executive Signals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(dashboard.insights || []).map((insight) => (
                    <div
                      key={insight}
                      className="rounded-2xl border border-[rgba(62,166,255,0.16)] bg-[rgba(62,166,255,0.08)] p-4 text-sm leading-6 text-[var(--text)]/90"
                    >
                      {insight}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Factory Output Rail</CardTitle>
                </CardHeader>
                <CardContent>
                  <FactoryChart
                    items={factoryStats}
                    selectedFactoryId={selectedFactoryId}
                    onSelect={setSelectedFactoryId}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Interlinked Shift Matrix</CardTitle>
                </CardHeader>
                <CardContent>
                  <ShiftChart items={shiftStats} selectedShift={selectedShift} onSelect={setSelectedShift} />
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Status Matrix Heatmap</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[980px] grid-cols-[100px_repeat(24,minmax(0,1fr))] gap-2">
                      <div />
                      {Array.from({ length: 24 }).map((_, hour) => (
                        <div key={hour} className="text-center text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                          {hour.toString().padStart(2, "0")}
                        </div>
                      ))}
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayLabel, rowIndex) => {
                        const dayCells = (dashboard.heatmap || []).slice(rowIndex * 24, rowIndex * 24 + 24);
                        return (
                          <Fragment key={dayCells[0]?.day || dayLabel}>
                            <div className="flex items-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                              {dayCells[0]?.label || dayLabel}
                            </div>
                            {dayCells.map((cell) => (
                              <div
                                key={`${cell.day}-${cell.hour}`}
                                title={`${cell.label} ${cell.hour}:00 - ${cell.count} events`}
                                className={`h-7 rounded-lg border border-[rgba(255,255,255,0.04)] ${levelClasses(cell.level)}`}
                              />
                            ))}
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <span>Low</span>
                    {[1, 2, 3, 4].map((level) => (
                      <span key={level} className={`inline-flex h-4 w-8 rounded ${levelClasses(level)}`} />
                    ))}
                    <span>High activity</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Audit Trail View</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {filteredAudit.length ? (
                    filteredAudit.slice(0, 12).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-[var(--text)]">{item.action}</div>
                          <div className="text-xs text-[var(--muted)]">{formatDateTime(item.timestamp)}</div>
                        </div>
                        <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                          {item.user_name || item.user_email || "System"}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[var(--text)]/85">{item.details || "-"}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--muted)]">
                      No audit events match the current premium filter scope.
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}

        {busy ? <div className="text-sm text-[var(--muted)]">Refreshing premium analytics...</div> : null}
        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {auditWarning ? <div className="text-sm text-amber-300">{auditWarning}</div> : null}
        {ocrWarning ? <div className="text-sm text-amber-300">{ocrWarning}</div> : null}
        {steelWarning ? <div className="text-sm text-amber-300">{steelWarning}</div> : null}
        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
