"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { selectFactory } from "@/lib/auth";
import { getControlTower, type ControlTowerPayload, type FactorySummary } from "@/lib/settings";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OperationalPageShell } from "@/components/ui/operational-page-shell";
import { DashboardPageSkeleton } from "@/components/page-skeletons";
import { DisclosurePanel } from "@/shared/operational/disclosure-panel";

function factoryTone(factory: FactorySummary) {
  if (factory.is_active_context) {
    return "border-[rgba(62,166,255,0.4)] bg-[rgba(62,166,255,0.12)]";
  }
  return "border-[var(--border)] bg-[rgba(20,24,36,0.82)]";
}

export default function ControlTowerPage() {
  const { user, loading: sessionLoading, activeFactoryId } = useSession();
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

  const handleSwitch = useCallback(async (factoryId: string) => {
    setSwitchingFactoryId(factoryId);
    setError("");
    try {
      await selectFactory(factoryId);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch factory context.");
      setSwitchingFactoryId(null);
    }
  }, []);

  if (sessionLoading || (loading && !payload && !error)) {
    return <DashboardPageSkeleton />;
  }

  return (
    <OperationalPageShell
      className="factory-workstation-scope"
      contentClassName="mx-auto max-w-7xl space-y-8"
      eyebrow="Control Tower"
      title="Factory context"
      description="Compare sites. Switch context."
      metrics={[
        { id: "factories", label: "Factories", value: payload?.factories.length ?? "-" },
        { id: "members", label: "Members", value: String(totals.members) },
      ]}
      actions={[
        {
          id: "refresh",
          label: loading ? "Refreshing..." : "Refresh",
          variant: "outline",
          onAction: () => {
            void loadControlTower();
          },
        },
      ]}
    >
        <DisclosurePanel title="Control tools" variant="ghost">
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard">
              <Button variant="outline">Board</Button>
            </Link>
            <Link href="/settings">
              <Button variant="outline">Settings</Button>
            </Link>
          </div>
        </DisclosurePanel>

        {error ? (
          <Card>
            <CardContent className="py-6 text-sm text-red-300">{error}</CardContent>
          </Card>
        ) : null}

        {payload ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  <div className="mt-2 text-sm text-[var(--muted)]">Visible factories</div>
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
                  <div className="mt-2 text-sm text-[var(--muted)]">Switch below.</div>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              {payload.factories.map((factory) => (
                <Card key={factory.factory_id} className={factoryTone(factory)}>
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-xl">{factory.name}</CardTitle>
                        <div className="mt-2 text-sm text-[var(--muted)]">
                          {factory.industry_label} · {factory.workflow_template_label}
                        </div>
                      </div>
                      <div className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        {factory.is_active_context ? "Active" : factory.my_role || "Member"}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
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
                    <div className="space-y-6">
                      <Button
                        onClick={() => void handleSwitch(factory.factory_id)}
                        disabled={switchingFactoryId === factory.factory_id || factory.factory_id === activeFactoryId}
                      >
                        {factory.factory_id === activeFactoryId
                          ? "Current Context"
                          : switchingFactoryId === factory.factory_id
                            ? "Switching..."
                            : "Switch Context"}
                      </Button>
                      {/* AUDIT: BUTTON_CLUTTER - keep open-desk routes available in a secondary reveal so switching context stays primary. */}
                      <details className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,24,0.62)] p-3">
                        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] marker:hidden">
                          Open desk
                        </summary>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link href="/dashboard">
                            <Button variant="outline">Board</Button>
                          </Link>
                          <Link href="/entry">
                            <Button variant="outline">Entry</Button>
                          </Link>
                        </div>
                      </details>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          </>
        ) : null}
    </OperationalPageShell>
  );
}
