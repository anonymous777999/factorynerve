"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { getAuthContext, selectFactory } from "@/lib/auth";
import { primeSession } from "@/lib/session-store";
import { coerceIntegerInput, digitsOnly } from "@/lib/validation";
import {
  createFactory,
  deactivateUser,
  getBillingStatus,
  getControlTower,
  getFactorySettings,
  getFactoryTemplates,
  getUsageSummary,
  getManagedUserFactoryAccess,
  inviteUser,
  listFactories,
  listFactoryProfiles,
  listManagedUsers,
  updateFactorySettings,
  updateManagedUserFactoryAccess,
  updateUserRole,
  type BillingStatus,
  type ControlTowerPayload,
  type FactorySummary,
  type FactoryProfileOption,
  type FactorySettings,
  type FactoryTemplatesPayload,
  type ManagedUser,
  type ManagedUserFactoryAccessPayload,
  type UsageSummary,
} from "@/lib/settings";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type TabKey = "factory" | "users" | "usage";

const USER_ROLES = ["attendance", "operator", "supervisor", "accountant", "manager", "admin", "owner"];

function emptyFactorySettings(): FactorySettings {
  return {
    factory_name: "",
    address: "",
    factory_type: "General Manufacturing",
    industry_type: "general",
    industry_label: "General Manufacturing",
    workflow_template_key: "general-ops-pack",
    workflow_template_label: "General Operations Pack",
    starter_modules: ["dpr", "downtime", "quality", "dispatch", "reports"],
    target_morning: 0,
    target_evening: 0,
    target_night: 0,
  };
}

function findTemplate(payload: FactoryTemplatesPayload | null, templateKey: string) {
  if (!payload) return null;
  return payload.templates.find((item) => item.key === templateKey) || payload.active_template || null;
}

export default function SettingsPage() {
  const { user, loading, error: sessionError, activeFactoryId } = useSession();
  const [tab, setTab] = useState<TabKey>("factory");
  const [factory, setFactory] = useState<FactorySettings>(() => emptyFactorySettings());
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [profiles, setProfiles] = useState<FactoryProfileOption[]>([]);
  const [factoryTemplates, setFactoryTemplates] = useState<FactoryTemplatesPayload | null>(null);
  const [newFactoryTemplates, setNewFactoryTemplates] = useState<FactoryTemplatesPayload | null>(null);
  const [factoryDirectory, setFactoryDirectory] = useState<FactorySummary[]>([]);
  const [controlTower, setControlTower] = useState<ControlTowerPayload | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("attendance");
  const [accessUserId, setAccessUserId] = useState("");
  const [accessSnapshot, setAccessSnapshot] = useState<ManagedUserFactoryAccessPayload | null>(null);
  const [accessFactoryIds, setAccessFactoryIds] = useState<string[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [roleUserId, setRoleUserId] = useState("");
  const [newRole, setNewRole] = useState("attendance");
  const [downgradeConfirm, setDowngradeConfirm] = useState("");
  const [deactivateUserId, setDeactivateUserId] = useState("");
  const [newFactoryForm, setNewFactoryForm] = useState({
    name: "",
    location: "",
    address: "",
    timezone: "Asia/Kolkata",
    industry_type: "general",
    workflow_template_key: "general-ops-pack",
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const canManage = user?.role === "manager" || user?.role === "admin" || user?.role === "owner";
  const canManageFactoryAccess = user?.role === "admin" || user?.role === "owner";
  const canViewBilling = user?.role === "admin" || user?.role === "owner";
  const assignableRoles = useMemo(
    () =>
      user?.role === "admin" || user?.role === "owner"
        ? USER_ROLES
        : USER_ROLES.filter((role) => role !== "admin" && role !== "owner"),
    [user?.role],
  );
  const currentIndustryProfile = useMemo(
    () => profiles.find((profile) => profile.key === factory.industry_type) || null,
    [factory.industry_type, profiles],
  );
  const selectedFactoryTemplate = useMemo(
    () => findTemplate(factoryTemplates, factory.workflow_template_key),
    [factory.workflow_template_key, factoryTemplates],
  );
  const selectedNewFactoryTemplate = useMemo(
    () => findTemplate(newFactoryTemplates, newFactoryForm.workflow_template_key),
    [newFactoryForm.workflow_template_key, newFactoryTemplates],
  );

  const loadAll = useCallback(async () => {
    if (!canManage) return;
    const results = await Promise.allSettled([
      getFactorySettings(),
      getFactoryTemplates(),
      listFactories(),
      getControlTower(),
      listManagedUsers(),
      getUsageSummary(),
      getBillingStatus(),
      listFactoryProfiles(),
    ]);
    const [factoryResult, templatesResult, factoriesResult, controlResult, usersResult, usageResult, billingResult, profilesResult] = results;
    if (factoryResult.status === "fulfilled") setFactory(factoryResult.value);
    if (templatesResult.status === "fulfilled") setFactoryTemplates(templatesResult.value);
    if (factoriesResult.status === "fulfilled") setFactoryDirectory(factoriesResult.value);
    if (controlResult.status === "fulfilled") setControlTower(controlResult.value);
    if (usersResult.status === "fulfilled") setUsers(usersResult.value);
    if (usageResult.status === "fulfilled") setUsage(usageResult.value);
    if (billingResult.status === "fulfilled") setBilling(billingResult.value);
    if (profilesResult.status === "fulfilled") setProfiles(profilesResult.value);
  }, [canManage]);

  useEffect(() => {
    loadAll().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load settings.");
    });
  }, [loadAll]);

  useEffect(() => {
    if (!canManageFactoryAccess) {
      setAccessUserId("");
      setAccessSnapshot(null);
      setAccessFactoryIds([]);
      setAccessLoading(false);
      return;
    }
    if (!users.length) {
      setAccessUserId("");
      setAccessSnapshot(null);
      setAccessFactoryIds([]);
      setAccessLoading(false);
      return;
    }
    if (users.some((item) => String(item.id) === accessUserId)) {
      return;
    }
    const preferredUser = users.find((item) => item.id === user?.id) || users[0];
    setAccessUserId(String(preferredUser.id));
  }, [accessUserId, canManageFactoryAccess, user?.id, users]);

  useEffect(() => {
    if (!canManageFactoryAccess || !accessUserId) {
      setAccessSnapshot(null);
      setAccessFactoryIds([]);
      setAccessLoading(false);
      return;
    }
    let cancelled = false;
    setAccessLoading(true);
    setError("");
    getManagedUserFactoryAccess(Number(accessUserId))
      .then((payload) => {
        if (cancelled) return;
        setAccessSnapshot(payload);
        setAccessFactoryIds(payload.factories.filter((item) => item.has_access).map((item) => item.factory_id));
      })
      .catch((err) => {
        if (cancelled) return;
        setAccessSnapshot(null);
        setAccessFactoryIds([]);
        setError(err instanceof Error ? err.message : "Could not load factory access.");
      })
      .finally(() => {
        if (!cancelled) {
          setAccessLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessUserId, canManageFactoryAccess]);

  useEffect(() => {
    if (!canManage || !factory.industry_type) return;
    getFactoryTemplates(factory.industry_type)
      .then((payload) => {
        setFactoryTemplates(payload);
        setFactory((prev) => {
          const template =
            payload.templates.find((item) => item.key === prev.workflow_template_key) ||
            payload.active_template ||
            payload.templates[0] ||
            null;
          return {
            ...prev,
            workflow_template_key: template?.key || payload.active_template_key,
            workflow_template_label: template?.label || payload.active_template_label,
            starter_modules: payload.starter_modules,
          };
        });
      })
      .catch(() => {
        // keep last known template catalog if the preview refresh fails
      });
  }, [canManage, factory.industry_type]);

  useEffect(() => {
    if (!newFactoryForm.industry_type) return;
    getFactoryTemplates(newFactoryForm.industry_type)
      .then((payload) => {
        setNewFactoryTemplates(payload);
        setNewFactoryForm((current) => ({
          ...current,
          workflow_template_key:
            payload.templates.find((item) => item.key === current.workflow_template_key)?.key ||
            payload.active_template_key,
        }));
      })
      .catch(() => {
        // no-op; defaults remain usable
      });
  }, [newFactoryForm.industry_type]);

  const activeCount = useMemo(() => users.filter((item) => item.is_active).length, [users]);
  const resolveManagedUserId = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      throw new Error("Enter a user ID first.");
    }
    const numeric = Number(trimmed);
    if (Number.isNaN(numeric) || !Number.isInteger(numeric) || numeric <= 0) {
      throw new Error("User ID must be numeric.");
    }
    const match = users.find((item) => item.user_code === numeric || item.id === numeric);
    if (!match) {
      throw new Error("User ID not found in your current organization.");
    }
    return match.id;
  };

  const toggleAccessFactory = (factoryId: string) => {
    setAccessFactoryIds((current) => {
      if (current.includes(factoryId)) {
        if (current.length === 1) {
          return current;
        }
        return current.filter((item) => item !== factoryId);
      }
      return [...current, factoryId];
    });
  };

  const handleAction = async (work: () => Promise<void>) => {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await work();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Request failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">Loading settings...</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
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

  if (!canManage) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">Factory settings and user management are available to managers, admins, and owners.</div>
            <div className="flex gap-3">
              <Link href="/dashboard">
                <Button>Back to Dashboard</Button>
              </Link>
              <Link href="/reports">
                <Button variant="outline">Open Reports</Button>
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
        <section className="flex flex-col gap-4 rounded-[1.9rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-5 shadow-2xl backdrop-blur sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Settings</div>
            <h1 className="mt-2 text-3xl font-semibold">Factory profile and team management</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Update factory targets, invite users, manage roles, and monitor plan usage from the Next.js app.
            </p>
          </div>
          <div className="grid gap-3 sm:flex sm:flex-wrap">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">Dashboard</Button>
            </Link>
            <Link href="/reports" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">Open Reports</Button>
            </Link>
            <Link href="/plans" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">Plans</Button>
            </Link>
            {canViewBilling ? (
              <Link href="/billing" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">Billing</Button>
              </Link>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Current Factory</div>
              <CardTitle>{factory.factory_name || user.factory_name || "-"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {(factory.industry_label || factory.factory_type || "Factory type not set yet.")} · {factory.workflow_template_label || "No template"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Factory Network</div>
              <CardTitle>{controlTower?.organization.total_factories || factoryDirectory.length || 1}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {controlTower?.organization.industry_breakdown.length
                ? controlTower.organization.industry_breakdown.map((item) => `${item.industry_label}: ${item.count}`).join(" · ")
                : "Visible factories in your current organization."}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Active Users</div>
              <CardTitle>{activeCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Plan {billing?.plan || usage?.plan || "-"} · Billing status: {billing?.status || "-"}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
              <Button className="shrink-0" variant={tab === "factory" ? "primary" : "outline"} onClick={() => setTab("factory")}>Factory Profile</Button>
              <Button className="shrink-0" variant={tab === "users" ? "primary" : "outline"} onClick={() => setTab("users")}>Users</Button>
              <Button className="shrink-0" variant={tab === "usage" ? "primary" : "outline"} onClick={() => setTab("usage")}>Usage & Billing</Button>
            </div>
          </CardHeader>
        </Card>

        {tab === "factory" ? (
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Factory Profile</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm text-[var(--muted)]">Factory Name</label>
                <Input value={factory.factory_name} onChange={(e) => setFactory((prev) => ({ ...prev, factory_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Industry Profile</label>
                <Select
                  value={factory.industry_type}
                  onChange={(e) => {
                    const nextProfile = profiles.find((profile) => profile.key === e.target.value);
                    setFactory((prev) => ({
                      ...prev,
                      industry_type: e.target.value,
                      industry_label: nextProfile?.label || prev.industry_label,
                      factory_type: nextProfile?.label || prev.factory_type,
                      starter_modules: nextProfile?.starter_modules || prev.starter_modules,
                    }));
                  }}
                >
                  {(profiles.length ? profiles : [{ key: "general", label: "General Manufacturing", description: "", starter_modules: [] }]).map((profile) => (
                    <option key={profile.key} value={profile.key}>
                      {profile.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {currentIndustryProfile?.description || "Choose the safest baseline industry workflow for this factory."}
                </p>
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Workflow Template</label>
                <Select
                  value={factory.workflow_template_key}
                  onChange={(e) => {
                    const selectedTemplate = factoryTemplates?.templates.find((item) => item.key === e.target.value);
                    setFactory((prev) => ({
                      ...prev,
                      workflow_template_key: e.target.value,
                      workflow_template_label: selectedTemplate?.label || prev.workflow_template_label,
                    }));
                  }}
                >
                  {(factoryTemplates?.templates || []).map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {selectedFactoryTemplate?.description ||
                    "Choose the operating template that becomes the default starter pack for this factory."}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-[var(--muted)]">Address</label>
                <Input value={factory.address} onChange={(e) => setFactory((prev) => ({ ...prev, address: e.target.value }))} />
              </div>
              <div className="md:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <div className="text-sm font-semibold">Starter Modules</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(selectedFactoryTemplate?.modules || factory.starter_modules || []).map((module) => (
                    <span
                      key={module}
                      className="rounded-full border border-[rgba(62,166,255,0.24)] bg-[rgba(62,166,255,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]"
                    >
                      {module.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
                {selectedFactoryTemplate?.sections?.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {selectedFactoryTemplate.sections.map((section) => (
                      <div key={section.key} className="rounded-2xl border border-[var(--border)]/70 bg-[rgba(8,12,20,0.55)] p-4">
                        <div className="text-sm font-semibold">{section.label}</div>
                        <div className="mt-1 text-xs leading-5 text-[var(--muted)]">{section.description}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {section.fields.map((field) => (
                            <span
                              key={field.key}
                              className="rounded-full border border-[var(--border)] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]"
                            >
                              {field.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Morning Target</label>
                <Input type="number" min={0} step={1} inputMode="numeric" value={factory.target_morning} onChange={(e) => setFactory((prev) => ({ ...prev, target_morning: coerceIntegerInput(e.target.value, 0) }))} />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Evening Target</label>
                <Input type="number" min={0} step={1} inputMode="numeric" value={factory.target_evening} onChange={(e) => setFactory((prev) => ({ ...prev, target_evening: coerceIntegerInput(e.target.value, 0) }))} />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Night Target</label>
                <Input type="number" min={0} step={1} inputMode="numeric" value={factory.target_night} onChange={(e) => setFactory((prev) => ({ ...prev, target_night: coerceIntegerInput(e.target.value, 0) }))} />
              </div>
              <div className="md:col-span-2">
                <Button
                  className="w-full sm:w-auto"
                  onClick={() =>
                    handleAction(async () => {
                      await updateFactorySettings(factory);
                      try {
                        const refreshedContext = await getAuthContext({ timeoutMs: 8000 });
                        primeSession(refreshedContext);
                      } catch {
                        // Do not fail save success if the session refresh call is temporarily unavailable.
                      }
                      await loadAll();
                      setStatus("Factory settings saved.");
                    })
                  }
                  disabled={busy}
                >
                  Save Factory Profile
                </Button>
              </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Create Factory</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-[var(--muted)]">Factory Name</label>
                    <Input value={newFactoryForm.name} onChange={(e) => setNewFactoryForm((prev) => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Industry Profile</label>
                    <Select
                      value={newFactoryForm.industry_type}
                      onChange={(e) => setNewFactoryForm((prev) => ({ ...prev, industry_type: e.target.value }))}
                    >
                      {(profiles.length ? profiles : [{ key: "general", label: "General Manufacturing", description: "", starter_modules: [] }]).map((profile) => (
                        <option key={profile.key} value={profile.key}>
                          {profile.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Workflow Template</label>
                    <Select
                      value={newFactoryForm.workflow_template_key}
                      onChange={(e) => setNewFactoryForm((prev) => ({ ...prev, workflow_template_key: e.target.value }))}
                    >
                      {(newFactoryTemplates?.industry_type === newFactoryForm.industry_type
                        ? newFactoryTemplates.templates
                        : []
                      ).map((template) => (
                        <option key={template.key} value={template.key}>
                          {template.label}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {selectedNewFactoryTemplate?.description || "Choose the starter workflow your team should see on day one."}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Location</label>
                    <Input value={newFactoryForm.location} onChange={(e) => setNewFactoryForm((prev) => ({ ...prev, location: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Address</label>
                    <Input value={newFactoryForm.address} onChange={(e) => setNewFactoryForm((prev) => ({ ...prev, address: e.target.value }))} />
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="text-sm font-semibold">Pack Preview</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      Shared industrial modules that will be enabled first for this factory.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(selectedNewFactoryTemplate?.modules || newFactoryTemplates?.starter_modules || []).map((module) => (
                        <span
                          key={module}
                          className="rounded-full border border-[rgba(62,166,255,0.24)] bg-[rgba(62,166,255,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]"
                        >
                          {module.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() =>
                      handleAction(async () => {
                        const created = await createFactory(newFactoryForm);
                        setStatus(`Factory ${created.factory.name} created and added to your control tower.`);
                        setNewFactoryForm({
                          name: "",
                          location: "",
                          address: "",
                          timezone: "Asia/Kolkata",
                          industry_type: "general",
                          workflow_template_key: "general-ops-pack",
                        });
                        setNewFactoryTemplates(null);
                        await loadAll();
                      })
                    }
                    disabled={busy || !newFactoryForm.name.trim()}
                  >
                    Create Factory
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Control Tower Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-[var(--muted)]">
                    Org: {controlTower?.organization.name || factory.factory_name || "Current organization"} · Plan {controlTower?.organization.plan || billing?.plan || "-"}
                  </div>
                  {factoryDirectory.length ? (
                    <div className="space-y-3">
                      {factoryDirectory.map((item) => (
                        <div key={item.factory_id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">{item.name}</div>
                              <div className="mt-1 text-xs text-[var(--muted)]">
                                {item.industry_label} · {item.workflow_template_label}
                              </div>
                            </div>
                            {item.is_active_context ? (
                              <span className="rounded-full border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-3 text-xs text-[var(--muted)]">
                            Code {item.factory_code || "-"} · Members {item.member_count} · Role {item.my_role || "-"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                      No additional factories yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}

        {tab === "users" ? (
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Users</CardTitle>
              </CardHeader>
              <CardContent>
                {users.length ? (
                  <>
                    <div className="space-y-3 md:hidden">
                      {users.map((row) => (
                        <div key={`mobile:${row.id}`} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">{row.name}</div>
                              <div className="mt-1 text-xs text-[var(--muted)]">#{row.user_code} · {row.role}</div>
                            </div>
                            <div className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                              {row.is_active ? "Active" : "Inactive"}
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="text-xs text-[var(--muted)]">Email</div>
                              <div className="mt-1 text-sm">{row.email}</div>
                            </div>
                            <div>
                              <div className="text-xs text-[var(--muted)]">Factory Access</div>
                              <div className="mt-1 text-sm">{row.factory_count === 1 ? "1 factory" : `${row.factory_count} factories`}</div>
                              <div className="text-xs text-[var(--muted)]">{row.factory_name}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-3 font-medium">User ID</th>
                          <th className="px-3 py-3 font-medium">Name</th>
                          <th className="px-3 py-3 font-medium">Email</th>
                          <th className="px-3 py-3 font-medium">Role</th>
                          <th className="px-3 py-3 font-medium">Factory Access</th>
                          <th className="px-3 py-3 font-medium">Plan</th>
                          <th className="px-3 py-3 font-medium">Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((row) => (
                          <tr key={row.id} className="border-b border-[var(--border)]/60">
                            <td className="px-3 py-3 font-semibold">{row.user_code}</td>
                            <td className="px-3 py-3">{row.name}</td>
                            <td className="px-3 py-3">{row.email}</td>
                            <td className="px-3 py-3">{row.role}</td>
                            <td className="px-3 py-3">
                              <div>{row.factory_count === 1 ? "1 factory" : `${row.factory_count} factories`}</div>
                              <div className="text-xs text-[var(--muted)]">{row.factory_name}</div>
                            </td>
                            <td className="px-3 py-3">{row.plan}</td>
                            <td className="px-3 py-3">{row.is_active ? "Yes" : "No"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                    No managed users found.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Invite User</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-[var(--muted)]">Name</label>
                    <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Email</label>
                    <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Role</label>
                    <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                      {assignableRoles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() =>
                      handleAction(async () => {
                        const result = await inviteUser({
                          name: inviteName,
                          email: inviteEmail,
                          role: inviteRole,
                          factory_name: factory.factory_name || user.factory_name || "",
                        });
                        setStatus(
                          result.temp_password
                            ? `User ${result.user_code ? `#${result.user_code} ` : ""}invited. Temporary password: ${result.temp_password}`
                            : result.message,
                        );
                        setInviteName("");
                        setInviteEmail("");
                        await loadAll();
                      })
                    }
                    disabled={busy}
                  >
                    Invite User
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Factory Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {canManageFactoryAccess ? (
                    <>
                      <div>
                        <label className="text-sm text-[var(--muted)]">User</label>
                        <Select value={accessUserId} onChange={(e) => setAccessUserId(e.target.value)}>
                          <option value="">Select a user</option>
                          {users.map((managedUser) => (
                            <option key={managedUser.id} value={managedUser.id}>
                              #{managedUser.user_code} {managedUser.name} - {managedUser.role}
                            </option>
                          ))}
                        </Select>
                      </div>
                      {accessLoading ? (
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                          Loading factory access...
                        </div>
                      ) : accessSnapshot ? (
                        <>
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                            <div className="text-sm font-semibold">{accessSnapshot.user.name}</div>
                            <div className="mt-1 text-xs text-[var(--muted)]">
                              #{accessSnapshot.user.user_code} - {accessSnapshot.user.role} - {accessSnapshot.user.factory_count} assigned
                            </div>
                          </div>
                          <div className="space-y-3">
                            {accessSnapshot.factories.map((factoryOption) => {
                              const checked = accessFactoryIds.includes(factoryOption.factory_id);
                              return (
                                <label
                                  key={factoryOption.factory_id}
                                  className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4"
                                >
                                  <div>
                                    <div className="text-sm font-semibold">{factoryOption.name}</div>
                                    <div className="mt-1 text-xs text-[var(--muted)]">
                                      {factoryOption.industry_label} · Members {factoryOption.member_count}
                                      {factoryOption.is_primary ? " · Primary context" : ""}
                                    </div>
                                    {factoryOption.location ? (
                                      <div className="mt-1 text-xs text-[var(--muted)]">{factoryOption.location}</div>
                                    ) : null}
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleAccessFactory(factoryOption.factory_id)}
                                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                                  />
                                </label>
                              );
                            })}
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            Owners and admins can place one user across multiple factories. At least one factory must stay selected.
                          </div>
                          <Button
                            className="w-full sm:w-auto"
                            onClick={() =>
                              handleAction(async () => {
                                if (!accessSnapshot) {
                                  throw new Error("Select a user first.");
                                }
                                const result = await updateManagedUserFactoryAccess(accessSnapshot.user.id, accessFactoryIds);
                                setAccessSnapshot(result);
                                setAccessFactoryIds(result.factories.filter((item) => item.has_access).map((item) => item.factory_id));
                                if (user?.id === result.user.id) {
                                  const stillHasActiveFactory = activeFactoryId
                                    ? result.factories.some((item) => item.factory_id === activeFactoryId && item.has_access)
                                    : false;
                                  if (!stillHasActiveFactory) {
                                    const fallbackFactoryId =
                                      result.user.primary_factory_id ||
                                      result.factories.find((item) => item.has_access)?.factory_id ||
                                      null;
                                    if (fallbackFactoryId) {
                                      const refreshedContext = await selectFactory(fallbackFactoryId);
                                      primeSession(refreshedContext);
                                    }
                                  } else {
                                    try {
                                      const refreshedContext = await getAuthContext({ timeoutMs: 8000 });
                                      primeSession(refreshedContext);
                                    } catch {
                                      // Keep the current session snapshot if the background refresh fails.
                                    }
                                  }
                                }
                                await loadAll();
                                setStatus(result.message);
                              })
                            }
                            disabled={busy || !accessSnapshot || !accessFactoryIds.length}
                          >
                            Save Factory Access
                          </Button>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                          Choose a user to manage factory membership.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                      Multi-factory access is managed by admins and owners.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Update Role / Deactivate</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-[var(--muted)]">User Code or ID</label>
                    <Input type="number" min={1} step={1} inputMode="numeric" value={roleUserId} onChange={(e) => setRoleUserId(digitsOnly(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">New Role</label>
                    <Select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                      {assignableRoles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Type DOWNGRADE to confirm lower roles</label>
                    <Input value={downgradeConfirm} onChange={(e) => setDowngradeConfirm(e.target.value)} />
                  </div>
                  <div className="grid gap-3 sm:flex sm:flex-wrap">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() =>
                        handleAction(async () => {
                          const result = await updateUserRole(resolveManagedUserId(roleUserId), newRole, downgradeConfirm);
                          setStatus(result.message);
                          await loadAll();
                        })
                      }
                      disabled={busy || !roleUserId}
                    >
                      Update Role
                    </Button>
                  </div>
                  <div className="border-t border-[var(--border)] pt-4">
                    <label className="text-sm text-[var(--muted)]">Deactivate User Code or ID</label>
                    <Input type="number" min={1} step={1} inputMode="numeric" value={deactivateUserId} onChange={(e) => setDeactivateUserId(digitsOnly(e.target.value))} />
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() =>
                          handleAction(async () => {
                            await deactivateUser(resolveManagedUserId(deactivateUserId));
                            setStatus("User deactivated.");
                            await loadAll();
                          })
                        }
                        disabled={busy || !deactivateUserId}
                      >
                        Deactivate User
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}

        {tab === "usage" ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Usage Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="text-sm text-[var(--muted)]">Requests Used</div>
                    <div className="mt-1 text-xl font-semibold">{usage?.requests_used ?? 0}</div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="text-sm text-[var(--muted)]">Credits Used</div>
                    <div className="mt-1 text-xl font-semibold">{usage?.credits_used ?? 0}</div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="text-sm text-[var(--muted)]">Request Limit</div>
                    <div className="mt-1 text-xl font-semibold">{usage?.max_requests || "Unlimited"}</div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="text-sm text-[var(--muted)]">Rate Limit / min</div>
                    <div className="mt-1 text-xl font-semibold">{usage?.rate_limit_per_minute ?? "-"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Billing Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="text-[var(--muted)]">Plan</div>
                  <div className="mt-1 text-lg font-semibold">{billing?.plan || "-"}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="text-[var(--muted)]">Status</div>
                  <div className="mt-1 text-lg font-semibold">{billing?.status || "-"}</div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-[var(--muted)]">Trial Ends</div>
                    <div>{billing?.trial_end_at || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">Current Period End</div>
                    <div>{billing?.current_period_end_at || "-"}</div>
                  </div>
                </div>
                {billing?.pending_plan ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    Pending plan: {billing.pending_plan} effective at {billing.pending_plan_effective_at || "-"}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
