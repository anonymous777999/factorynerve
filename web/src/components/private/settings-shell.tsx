"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GuidanceBlock } from "@/components/ui/guidance-block";
import { SettingsTabNav, type SettingsTabKey } from "@/components/private/settings-tab-nav";

type SummaryCard = {
  title: string;
  value: ReactNode;
  detail: ReactNode;
};

type SettingsShellProps = {
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
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
        <div>
          <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">{title}</div>
          <h1 className="mt-2 text-3xl font-semibold">{heroTitle}</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{heroSubtitle}</p>
        </div>
      </section>

      <details className="rounded-[28px] border border-[var(--border)] bg-[rgba(12,16,24,0.72)] p-5">
        <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)] marker:hidden">
          {toolsTitle}
        </summary>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/dashboard">
            <Button variant="outline">{toolLabels.board}</Button>
          </Link>
          <Link href="/reports">
            <Button>{toolLabels.reports}</Button>
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
      </details>

      <GuidanceBlock
        surfaceKey="settings-flow"
        title={guidance.title}
        summary={guidance.summary}
        eyebrow={title}
        className="border-[var(--border)] bg-[rgba(10,14,24,0.68)]"
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { step: guidance.scopeTitle, caption: guidance.scopeDetail },
            { step: guidance.rulesTitle, caption: guidance.rulesDetail },
            { step: guidance.verifyTitle, caption: guidance.verifyDetail },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-[24px] border border-[var(--border)] bg-[rgba(10,14,24,0.68)] px-5 py-4"
            >
              <div className="text-sm font-semibold text-[var(--text)]">{item.step}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{item.caption}</div>
            </div>
          ))}
        </div>
      </GuidanceBlock>

      <section className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{card.title}</div>
              <CardTitle>{card.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">{card.detail}</CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <SettingsTabNav
            activeTab={activeTab}
            canManageAlerts={canManageAlerts}
            canManageFeedback={canManageFeedback}
            labels={tabLabels}
            onTabChange={onTabChange}
          />
        </CardHeader>
      </Card>

      {children}
    </>
  );
}
