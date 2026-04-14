"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { useMobileRouteFunnel } from "@/lib/mobile-route-funnel";
import { selectFactory } from "@/lib/auth";
import { getControlTower, type ControlTowerPayload, type FactorySummary } from "@/lib/settings";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPageSkeleton } from "@/components/page-skeletons";

function factoryTone(factory: FactorySummary) {
  if (factory.is_active_context) {
    return "border-[rgba(62,166,255,0.4)] bg-[rgba(62,166,255,0.12)]";
  }
  return "border-[var(--border)] bg-[rgba(20,24,36,0.82)]";
}

export default function ControlTowerPage() {
  const { user, loading: sessionLoading, activeFactoryId } = useSession();
  const trackPrimaryAction = useMobileRouteFunnel("/control-tower", user?.role, Boolean(user));
  const [payload, setPayload] = useState<ControlTowerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingFactoryId, setSwitchingFactoryId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadControlTower = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await getControlTower();
      setPayload(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
          setError("Control Tower is available to manager, admin, and owner accounts for multi-factory oversight.");
      } else {
        setError(err instanceof Error ? err.message : "Could not load control-tower data.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadControlTower();
  }, [loadControlTower, user]);

  const totals = useMemo(() => {
    const factories = payload?.factories || [];
    return {
      members: factories.reduce((sum, item) => sum + item.member_count, 0),
      industries: new Set(factories.map((item) => item.industry_type)).size,
    };
  }, [payload]);
  const sortedFactories = useMemo(() => {
    return [...(payload?.factories || [])].sort((left, right) => {
      if (left.is_active_context && !right.is_active_context) return -1;
      if (!left.is_active_context && right.is_active_context) return 1;
      return right.member_count - left.member_count;
    });
  }, [payload]);
  const activeContextFactory = useMemo(
    () => sortedFactories.find((item) => item.factory_id === activeFactoryId) || sortedFactories[0] || null,
    [activeFactoryId, sortedFactories],
  );

  const handleSwitch = useCallback(async (factoryId: string) => {
    setSwitchingFactoryId(factoryId);
    setError("");
    try {
      await selectFactory(factoryId);
      trackPrimaryAction("switch_factory");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch factory context.");
      setSwitchingFactoryId(null);
    }
  }, [trackPrimaryAction]);

  if (sessionLoading || (loading && !payload && !error)) {
    return <DashboardPageSkeleton />;
  }

  return (
    <main className="min-h-screen px-4 py-6 pb-24 md:px-8 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Control Tower</div>
              <h1 className="mt-2 text-3xl font-semibold">Multi-factory command view</h1>
              <p className="mt-3 max-w-3xl text-sm text-[var(--muted)]">
                Compare factory contexts, see which workflow pack each site is running, and jump into the active plant
                without going through settings.
              </p>
            </div>
            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <Link href="/dashboard">
                <Button variant="outline" className="w-full sm:w-auto">Dashboard</Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline" className="w-full sm:w-auto">Factory Settings</Button>
              </Link>
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => void loadControlTower()} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-400/30 bg-rose-400/12 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {payload ? (
          <>
            <section className="grid gap-3 lg:hidden">
              <Card className="border-[rgba(62,166,255,0.25)] bg-[rgba(62,166,255,0.08)]">
                <CardHeader>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Active context</div>
                  <CardTitle>{activeContextFactory?.name || "Factory not selected"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-[var(--muted)]">
                  <div>
                    {activeContextFactory
                      ? `${activeContextFactory.industry_label} | ${activeContextFactory.workflow_template_label}`
                      : "Choose a factory to open the correct owner, report, and entry surfaces."}
                  </div>
                  <div>
                    {payload.organization.total_factories} factories | {totals.members} members | plan {payload.organization.plan}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Quick switch</div>
                  <CardTitle>Pick the next plant without scrolling the full desktop board</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sortedFactories.map((factory) => (
                    <div key={`mobile:${factory.factory_id}`} className={`rounded-2xl border p-4 ${factoryTone(factory)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--text)]">{factory.name}</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            {factory.industry_label} | {factory.workflow_template_label}
                          </div>
                        </div>
                        <div className="rounded-full border border-[var(--border)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                          {factory.is_active_context ? "Active" : factory.my_role || "Member"}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[var(--muted)]">
                        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.55)] px-3 py-2">
                          <div>Members</div>
                          <div className="mt-1 text-sm font-semibold text-[var(--text)]">{factory.member_count}</div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.55)] px-3 py-2">
                          <div>Modules</div>
                          <div className="mt-1 text-sm font-semibold text-[var(--text)]">{factory.starter_modules.length}</div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2">
                        <Button
                          className="w-full"
                          onClick={() => void handleSwitch(factory.factory_id)}
                          disabled={switchingFactoryId === factory.factory_id || factory.factory_id === activeFactoryId}
                        >
                          {factory.factory_id === activeFactoryId
                            ? "Current Context"
                            : switchingFactoryId === factory.factory_id
                              ? "Switching..."
                              : "Switch Context"}
                        </Button>
                        <details className="rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.48)] px-4 py-3">
                          <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                            Factory details
                          </summary>
                          <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                            <div>Factory code: <span className="text-[var(--text)]">{factory.factory_code || "-"}</span></div>
                            <div>Timezone: <span className="text-[var(--text)]">{factory.timezone || "-"}</span></div>
                            <div>Location: <span className="text-[var(--text)]">{factory.location || "-"}</span></div>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {factory.starter_modules.map((module) => (
                                <span
                                  key={`${factory.factory_id}:${module}`}
                                  className="rounded-full border border-[var(--border)] px-3 py-1 text-[11px] text-[var(--muted)]"
                                >
                                  {module}
                                </span>
                              ))}
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <section className="hidden gap-4 lg:grid sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Factories</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-semibold">{payload.organization.total_factories}</div>
                  <div className="mt-2 text-sm text-[var(--muted)]">Plan: {payload.organization.plan}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Industries Covered</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-semibold">{totals.industries}</div>
                  <div className="mt-2 text-sm text-[var(--muted)]">
                    {payload.organization.industry_breakdown.map((item) => `${item.industry_label} (${item.count})`).join(", ")}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Accessible Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-semibold">{totals.members}</div>
                  <div className="mt-2 text-sm text-[var(--muted)]">Combined team size across visible factories.</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Active Context</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">
                    {payload.factories.find((item) => item.factory_id === activeFactoryId)?.name || "Factory not selected"}
                  </div>
                  <div className="mt-2 text-sm text-[var(--muted)]">
                    Switch context below to open the correct dashboard, entry form, and reports for that site.
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="hidden gap-4 lg:grid lg:grid-cols-3">
              {sortedFactories.map((factory) => (
                <Card key={factory.factory_id} className={factoryTone(factory)}>
                  <CardHeader className="space-y-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="text-xl">{factory.name}</CardTitle>
                        <div className="mt-2 text-sm text-[var(--muted)]">
                          {factory.industry_label} - {factory.workflow_template_label}
                        </div>
                      </div>
                      <div className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        {factory.is_active_context ? "Active" : factory.my_role || "Member"}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--border)] px-4 py-3">
                        <div className="text-xs text-[var(--muted)]">Factory Code</div>
                        <div className="mt-1 text-base font-semibold">{factory.factory_code || "-"}</div>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] px-4 py-3">
                        <div className="text-xs text-[var(--muted)]">Members</div>
                        <div className="mt-1 text-base font-semibold">{factory.member_count}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--muted)]">
                      <div>Timezone: <span className="text-[var(--text)]">{factory.timezone || "-"}</span></div>
                      <div className="mt-1">Location: <span className="text-[var(--text)]">{factory.location || "-"}</span></div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Starter Modules</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {factory.starter_modules.map((module) => (
                          <span
                            key={module}
                            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
                          >
                            {module}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:flex sm:flex-wrap">
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() => void handleSwitch(factory.factory_id)}
                        disabled={switchingFactoryId === factory.factory_id || factory.factory_id === activeFactoryId}
                      >
                        {factory.factory_id === activeFactoryId
                          ? "Current Context"
                          : switchingFactoryId === factory.factory_id
                            ? "Switching..."
                            : "Switch Context"}
                      </Button>
                      <Link href="/dashboard">
                        <Button variant="outline" className="w-full sm:w-auto">Open Dashboard</Button>
                      </Link>
                      <Link href="/entry">
                        <Button variant="outline" className="w-full sm:w-auto">Open Entry</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
