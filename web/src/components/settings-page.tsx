"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { getAuthContext, selectFactory } from "@/lib/auth";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { primeSession } from "@/lib/session-store";
import {
  createFactory,
  deactivateUser,
  getBillingStatus,
  getControlTower,
  getFactorySettings,
  getFactoryTemplates,
  getManagedUserFactoryAccess,
  getUsageSummary,
  inviteUser,
  listFactories,
  listFactoryProfiles,
  listManagedUsers,
  updateFactorySettings,
  updateManagedUserFactoryAccess,
  updateUserRole,
  type BillingStatus,
  type ControlTowerPayload,
  type FactoryProfileOption,
  type FactorySettings,
  type FactorySummary,
  type FactoryTemplatesPayload,
  type ManagedUser,
  type ManagedUserFactoryAccessPayload,
  type UsageSummary,
} from "@/lib/settings";
import { useSession } from "@/lib/use-session";
import { coerceIntegerInput, digitsOnly } from "@/lib/validation";
import SettingsAlertsTab from "@/components/settings-alerts-tab";
import { SettingsFactoryTab } from "@/components/settings-factory-tab";
import SettingsFeedbackTab from "@/components/settings-feedback-tab";
import { SettingsShell } from "@/components/settings-shell";
import { SettingsTabKey } from "@/components/settings-tab-nav";
import { SettingsUsageTab } from "@/components/settings-usage-tab";
import { SettingsUsersTab } from "@/components/settings-users-tab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const USER_ROLES = ["attendance", "operator", "supervisor", "accountant", "manager", "admin", "owner"];
const SETTINGS_TABS: SettingsTabKey[] = ["factory", "users", "usage", "alerts", "feedback"];

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

function isSettingsTabKey(value: string | null): value is SettingsTabKey {
  return value != null && SETTINGS_TABS.includes(value as SettingsTabKey);
}

function getDefaultSettingsTab({
  canManage,
  canManageFeedback,
}: {
  canManage: boolean;
  canManageFeedback: boolean;
}): SettingsTabKey {
  if (!canManage && canManageFeedback) {
    return "feedback";
  }
  return "factory";
}

function normalizeSettingsTab({
  canManage,
  canManageAlerts,
  canManageFeedback,
  rawTab,
}: {
  canManage: boolean;
  canManageAlerts: boolean;
  canManageFeedback: boolean;
  rawTab: string | null;
}): SettingsTabKey {
  const fallback = getDefaultSettingsTab({ canManage, canManageFeedback });
  if (!isSettingsTabKey(rawTab)) {
    return fallback;
  }
  if (rawTab === "alerts" && !canManageAlerts) {
    return fallback;
  }
  if (rawTab === "feedback" && !canManageFeedback) {
    return fallback;
  }
  if ((rawTab === "factory" || rawTab === "users" || rawTab === "usage") && !canManage) {
    return fallback;
  }
  return rawTab;
}

export default function SettingsPage() {
  const { t } = useI18n();
  useI18nNamespaces(["common", "settings"]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading, error: sessionError, activeFactoryId } = useSession();
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
  const canManageAlerts = user?.role === "admin" || user?.role === "owner";
  const canManageFeedback = user?.is_platform_admin === true;
  const canOpenSettings = canManage || canManageFeedback;
  const requestedTab = searchParams.get("tab");
  const activeTab = useMemo(
    () =>
      normalizeSettingsTab({
        canManage,
        canManageAlerts,
        canManageFeedback,
        rawTab: requestedTab,
      }),
    [canManage, canManageAlerts, canManageFeedback, requestedTab],
  );
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
    const [
      factoryResult,
      templatesResult,
      factoriesResult,
      controlResult,
      usersResult,
      usageResult,
      billingResult,
      profilesResult,
    ] = results;
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
    if (loading || !user || !canOpenSettings) {
      return;
    }
    if (requestedTab === activeTab) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", activeTab);
    router.replace(`${pathname}?${params.toString()}`);
  }, [activeTab, canOpenSettings, loading, pathname, requestedTab, router, searchParams, user]);

  const navigateTab = useCallback(
    (nextTab: SettingsTabKey) => {
      const normalizedTab = normalizeSettingsTab({
        canManage,
        canManageAlerts,
        canManageFeedback,
        rawTab: nextTab,
      });
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", normalizedTab);
      router.push(`${pathname}?${params.toString()}`);
    },
    [canManage, canManageAlerts, canManageFeedback, pathname, router, searchParams],
  );

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
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        {t("common.loading", "Loading...")} {t("settings.title", "Settings").toLowerCase()}...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t("settings.title", "Settings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">
              {sessionError || t("settings.sign_in_required", "Please sign in to continue.")}
            </div>
            <Link href="/access">
              <Button>{t("dashboard.action.open_login", "Open Access")}</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canManage && canManageFeedback) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
            <div>
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
                {t("settings.title", "Settings")}
              </div>
              <h1 className="mt-2 text-3xl font-semibold">{t("settings.tabs.feedback", "Feedback")}</h1>
              <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
                Platform-admin access is limited to the feedback console in this workspace.
              </p>
            </div>
          </section>
          <SettingsFeedbackTab active />
          {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
        </div>
      </main>
    );
  }

  if (!canOpenSettings) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t("settings.title", "Settings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">
              {t(
                "settings.restricted",
                "Factory settings and user management are available to managers, admins, and owners.",
              )}
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard">
                <Button>
                  {t("common.back", "Back")} {t("navigation.nav.today_board.label", "Dashboard")}
                </Button>
              </Link>
              <Link href="/reports">
                <Button variant="ghost">{t("dashboard.action.open_reports", "Open Reports")}</Button>
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
        <SettingsShell
          title={t("settings.title", "Settings")}
          heroTitle={t("settings.hero.title", "Keep factory setup and team control in one admin lane")}
          heroSubtitle={t(
            "settings.hero.subtitle",
            "Update factory setup, manage people, and check plan posture without leaving the admin workspace.",
          )}
          toolsTitle={t("settings.tools.title", "Admin tools")}
          toolLabels={{
            board: t("settings.tools.board", "Board"),
            reports: t("settings.tools.reports", "Reports"),
            plans: t("settings.tools.plans", "Plans"),
            billing: t("settings.tools.billing", "Billing"),
          }}
          canViewBilling={canViewBilling}
          guidance={{
            title: t("settings.help.title", "Admin flow"),
            summary: t(
              "settings.help.summary",
              "Make one change at a time. Check usage or billing after setup is stable.",
            ),
            scopeTitle: t("settings.steps.scope", "Pick scope"),
            scopeDetail: t("settings.steps.scope_detail", "Choose factory, people, or plan work first."),
            rulesTitle: t("settings.steps.rules", "Update rules"),
            rulesDetail: t(
              "settings.steps.rules_detail",
              "Save the active admin change before switching lanes.",
            ),
            verifyTitle: t("settings.steps.verify", "Verify impact"),
            verifyDetail: t(
              "settings.steps.verify_detail",
              "Check usage and billing once the setup is stable.",
            ),
          }}
          summaryCards={[
            {
              title: t("settings.cards.current_factory", "Current Factory"),
              value: factory.factory_name || user.factory_name || "-",
              detail: `${factory.industry_label || factory.factory_type || t("settings.cards.factory_type_empty", "Factory type not set yet.")} · ${factory.workflow_template_label || t("settings.cards.no_template", "No template")}`,
            },
            {
              title: t("settings.cards.factory_network", "Factory Network"),
              value: controlTower?.organization.total_factories || factoryDirectory.length || 1,
              detail: controlTower?.organization.industry_breakdown.length
                ? controlTower.organization.industry_breakdown
                    .map((item) => `${item.industry_label}: ${item.count}`)
                    .join(" · ")
                : t("settings.cards.factory_network_empty", "Visible factories in your current organization."),
            },
            {
              title: t("settings.cards.active_users", "Active Users"),
              value: activeCount,
              detail: t("settings.cards.plan_status", "Plan {{plan}} · Billing status: {{status}}", {
                plan: billing?.plan || usage?.plan || "-",
                status: billing?.status || "-",
              }),
            },
          ]}
          activeTab={activeTab}
          canManageAlerts={canManageAlerts}
          canManageFeedback={canManageFeedback}
          tabLabels={{
            factory: t("settings.tabs.factory", "Factory"),
            users: t("settings.tabs.users", "Users"),
            usage: t("settings.tabs.usage", "Usage"),
            alerts: t("settings.tabs.alerts", "Alerts"),
            feedback: t("settings.tabs.feedback", "Feedback"),
          }}
          onTabChange={navigateTab}
        >
          {activeTab === "factory" ? (
            <SettingsFactoryTab
              busy={busy}
              billing={billing}
              controlTower={controlTower}
              factory={factory}
              factoryDirectory={factoryDirectory}
              factoryTemplates={factoryTemplates}
              profiles={profiles}
              currentIndustryProfile={currentIndustryProfile}
              selectedFactoryTemplate={selectedFactoryTemplate}
              newFactoryForm={newFactoryForm}
              newFactoryTemplates={newFactoryTemplates}
              selectedNewFactoryTemplate={selectedNewFactoryTemplate}
              onFactoryChange={setFactory}
              onNewFactoryFormChange={setNewFactoryForm}
              onSaveFactoryProfile={() =>
                void handleAction(async () => {
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
              onCreateFactory={() =>
                void handleAction(async () => {
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
              coerceIntegerInput={coerceIntegerInput}
            />
          ) : null}

          {activeTab === "users" ? (
            <SettingsUsersTab
              accessFactoryIds={accessFactoryIds}
              accessLoading={accessLoading}
              accessSnapshot={accessSnapshot}
              accessUserId={accessUserId}
              assignableRoles={assignableRoles}
              busy={busy}
              canManageFactoryAccess={canManageFactoryAccess}
              deactivateUserId={deactivateUserId}
              downgradeConfirm={downgradeConfirm}
              inviteEmail={inviteEmail}
              inviteName={inviteName}
              inviteRole={inviteRole}
              newRole={newRole}
              roleUserId={roleUserId}
              users={users}
              onAccessUserIdChange={setAccessUserId}
              onDeactivateUserIdChange={(value) => setDeactivateUserId(digitsOnly(value))}
              onDowngradeConfirmChange={setDowngradeConfirm}
              onInviteEmailChange={setInviteEmail}
              onInviteNameChange={setInviteName}
              onInviteRoleChange={setInviteRole}
              onNewRoleChange={setNewRole}
              onRoleUserIdChange={(value) => setRoleUserId(digitsOnly(value))}
              onInviteUser={() =>
                void handleAction(async () => {
                  const result = await inviteUser({
                    name: inviteName,
                    email: inviteEmail,
                    role: inviteRole,
                    factory_name: factory.factory_name || user.factory_name || "",
                  });
                  const previewLinks =
                    result.verification_link && result.reset_link
                      ? ` Verify: ${result.verification_link} Reset: ${result.reset_link}`
                      : "";
                  setStatus(
                    `${result.user_code ? `User #${result.user_code} ` : "User "}${result.message}${previewLinks}`,
                  );
                  setInviteName("");
                  setInviteEmail("");
                  await loadAll();
                })
              }
              onSaveFactoryAccess={() =>
                void handleAction(async () => {
                  if (!accessSnapshot) {
                    throw new Error("Select a user first.");
                  }
                  const result = await updateManagedUserFactoryAccess(accessSnapshot.user.id, accessFactoryIds);
                  setAccessSnapshot(result);
                  setAccessFactoryIds(
                    result.factories.filter((item) => item.has_access).map((item) => item.factory_id),
                  );
                  if (user?.id === result.user.id) {
                    const stillHasActiveFactory = activeFactoryId
                      ? result.factories.some(
                          (item) => item.factory_id === activeFactoryId && item.has_access,
                        )
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
              onToggleAccessFactory={toggleAccessFactory}
              onUpdateRole={() =>
                void handleAction(async () => {
                  const result = await updateUserRole(
                    resolveManagedUserId(roleUserId),
                    newRole,
                    downgradeConfirm,
                  );
                  setStatus(result.message);
                  await loadAll();
                })
              }
              onDeactivateUser={() =>
                void handleAction(async () => {
                  await deactivateUser(resolveManagedUserId(deactivateUserId));
                  setStatus("User deactivated.");
                  await loadAll();
                })
              }
            />
          ) : null}

          {activeTab === "usage" ? <SettingsUsageTab billing={billing} usage={usage} /> : null}
          {activeTab === "alerts" && canManageAlerts ? (
            <SettingsAlertsTab active={activeTab === "alerts"} />
          ) : null}
          {activeTab === "feedback" && canManageFeedback ? (
            <SettingsFeedbackTab active={activeTab === "feedback"} />
          ) : null}
        </SettingsShell>

        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
