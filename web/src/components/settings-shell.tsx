"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { GuidanceBlock } from "@/components/ui/guidance-block";
import { MetricStrip } from "@/components/ui/metric-strip";
import { SettingsTabNav, type SettingsTabKey } from "@/components/settings-tab-nav";

type SummaryCard = {
  title: string;
  value: ReactNode;
  detail: ReactNode;
};

type SettingsShellProps = {
  /** When true, header and metric strip are provided by OperationalPageShell. */
  embedded?: boolean;
  title: string;
  heroTitle: string;
  heroSubtitle: string;
  toolsTitle: string;
  toolLabels: {
    board: string;
    reports: string;
    plans: string;
    billing: string;
  };
  canViewBilling: boolean;
  guidance: {
    title: string;
    summary: string;
    scopeTitle: string;
    scopeDetail: string;
    rulesTitle: string;
    rulesDetail: string;
    verifyTitle: string;
    verifyDetail: string;
  };
  summaryCards: [SummaryCard, SummaryCard, SummaryCard];
  activeTab: SettingsTabKey;
  canManageAlerts: boolean;
  canManageFeedback: boolean;
  tabLabels: {
    factory: string;
    users: string;
    usage: string;
    alerts: string;
    feedback: string;
  };
  onTabChange: (tab: SettingsTabKey) => void;
  children: ReactNode;
};

export function SettingsShell({
  embedded = false,
  title,
  heroTitle,
  heroSubtitle,
  toolsTitle,
  toolLabels,
  canViewBilling,
  guidance,
  summaryCards,
  activeTab,
  canManageAlerts,
  canManageFeedback,
  tabLabels,
  onTabChange,
  children,
}: SettingsShellProps) {
  return (
    <>
      {!embedded ? (
        <section className="route-header">
          <div className="route-header__grid">
            <div className="route-header__copy">
              <p className="route-header__eyebrow text-action-primary">{title}</p>
              <h1 className="route-header__title">{heroTitle}</h1>
              <p className="route-header__body">{heroSubtitle}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="route-panel">
        <header className="route-panel__header flex flex-wrap items-center justify-between gap-3">
          <p className="text-label font-semibold text-text-primary">{toolsTitle}</p>
        </header>
        <div className="route-panel__body flex flex-wrap gap-3">
          <Link href="/dashboard">
            <Button variant="outline">{toolLabels.board}</Button>
          </Link>
          <Link href="/reports">
            <Button variant="outline">{toolLabels.reports}</Button>
          </Link>
          <Link href="/plans">
            <Button variant="outline">{toolLabels.plans}</Button>
          </Link>
          {canViewBilling ? (
            <Link href="/billing">
              <Button variant="outline">{toolLabels.billing}</Button>
            </Link>
          ) : null}
        </div>
      </section>

      <GuidanceBlock
        surfaceKey="settings-flow"
        title={guidance.title}
        summary={guidance.summary}
        eyebrow={title}
        className="route-panel"
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { step: guidance.scopeTitle, caption: guidance.scopeDetail },
            { step: guidance.rulesTitle, caption: guidance.rulesDetail },
            { step: guidance.verifyTitle, caption: guidance.verifyDetail },
          ].map((item) => (
            <div key={item.step} className="rounded-panel border border-border-subtle bg-surface-shell px-5 py-4">
              <p className="text-sm font-semibold text-text-primary">{item.step}</p>
              <p className="mt-2 text-sm text-text-secondary">{item.caption}</p>
            </div>
          ))}
        </div>
      </GuidanceBlock>

      {!embedded ? (
        <MetricStrip
          compact
          items={summaryCards.map((card, index) => ({
            id: `summary-${index}`,
            label: card.title,
            value: card.value,
            detail: card.detail,
          }))}
        />
      ) : null}

      <SettingsTabNav
        activeTab={activeTab}
        canManageAlerts={canManageAlerts}
        canManageFeedback={canManageFeedback}
        labels={tabLabels}
        onTabChange={onTabChange}
      />

      {children}
    </>
  );
}
