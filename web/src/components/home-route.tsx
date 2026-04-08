"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { getHomeDestination } from "@/lib/role-navigation";
import { useSession } from "@/lib/use-session";

const homepageSignals = [
  {
    label: "Attendance",
    title: "Shift punch and status in one tap",
    detail: "Workers can start, continue, and close the day without hunting through menus.",
  },
  {
    label: "OCR",
    title: "Paper registers into structured rows",
    detail: "Capture factory documents, verify them, and move them into reports without retyping.",
  },
  {
    label: "Reports",
    title: "Managers get one trusted operating view",
    detail: "Approvals, alerts, exports, and decision signals stay connected instead of scattered.",
  },
];

const homepagePrinciples = [
  "Mobile first for real factory use",
  "Offline-aware workflow on weak networks",
  "Role-based desks for operators, supervisors, and owners",
  "Clear review lanes before data reaches reports",
];

const homepageSteps = [
  {
    step: "01",
    title: "Capture the floor fast",
    detail: "Start from shift entry, attendance, or document scan depending on the worker's job.",
  },
  {
    step: "02",
    title: "Review before trust breaks",
    detail: "Supervisors clear OCR, attendance, and queue issues in one visible place.",
  },
  {
    step: "03",
    title: "Run the day from one board",
    detail: "Managers and owners move from live signals to reports, not from confusion to spreadsheets.",
  },
];

function destinationLabel(href: string) {
  switch (href) {
    case "/attendance":
      return "your attendance desk";
    case "/dashboard":
      return "your operations board";
    case "/approvals":
      return "your review queue";
    case "/reports":
      return "your reports desk";
    case "/settings":
      return "your admin desk";
    case "/control-tower":
      return "your factory network";
    case "/premium/dashboard":
      return "your owner desk";
    default:
      return "your workspace";
  }
}

export default function HomeRoute() {
  const router = useRouter();
  const { user, organization, loading, error } = useSession();

  const destination = useMemo(
    () => getHomeDestination(user?.role, organization?.accessible_factories || 0),
    [organization?.accessible_factories, user?.role],
  );

  useEffect(() => {
    if (!loading && user) {
      router.replace(destination);
    }
  }, [destination, loading, router, user]);

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden px-4 py-8 md:px-6">
        <div className="absolute inset-0">
          <div className="absolute left-[8%] top-[10%] h-40 w-40 rounded-full bg-[rgba(77,163,255,0.16)] blur-3xl" />
          <div className="absolute right-[10%] top-[16%] h-48 w-48 rounded-full bg-[rgba(20,184,166,0.14)] blur-3xl" />
        </div>
        <div className="relative mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center">
          <Card variant="elevated" className="w-full max-w-xl">
            <CardHeader>
              <div className="surface-pill inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(77,163,255,0.92)]">
                FactoryNerve
              </div>
              <CardTitle className="mt-4 text-3xl">Loading your workspace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-[var(--muted)]">
                Checking your session and opening the right desk for your role.
              </p>
              <div className="surface-panel-soft rounded-[1.25rem] p-4 text-sm text-text-secondary">
                Attendance, OCR, review, and reporting are lining up now.
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="relative min-h-screen overflow-hidden px-4 py-6 md:px-6 md:py-8">
        <div className="absolute inset-0">
          <div className="absolute left-[-4rem] top-8 h-48 w-48 rounded-full bg-[rgba(77,163,255,0.14)] blur-3xl" />
          <div className="absolute right-[-3rem] top-20 h-56 w-56 rounded-full bg-[rgba(20,184,166,0.12)] blur-3xl" />
          <div className="absolute bottom-[-4rem] left-[30%] h-64 w-64 rounded-full bg-[rgba(245,158,11,0.08)] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl space-y-6">
          <section className="surface-panel-strong relative isolate overflow-hidden rounded-[2rem] p-5 md:p-8">
            <DottedSurface className="absolute inset-0 opacity-95" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(77,163,255,0.26),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(20,184,166,0.2),transparent_28%),linear-gradient(115deg,rgba(7,14,24,0.72)_4%,rgba(7,14,24,0.34)_48%,rgba(7,14,24,0.7)_100%)]" />
            <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-end">
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <span className="surface-pill rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(77,163,255,0.92)]">
                    FactoryNerve
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                    Factory OS by DPR.ai
                  </span>
                </div>

                <div className="space-y-4">
                  <h1 className="max-w-4xl text-4xl font-semibold leading-tight md:text-5xl">
                    Daily factory work that feels clear, light, and mobile-ready.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-text-secondary">
                    Run attendance, shift entry, OCR, approvals, and reports from one connected workspace instead of paper, chats, and scattered sheets.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link href="/login" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto">Sign in</Button>
                  </Link>
                  <Link href="/register" className="w-full sm:w-auto">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto">Create account</Button>
                  </Link>
                  <Link href="/ocr/scan" className="w-full sm:w-auto">
                    <Button variant="ghost" size="lg" className="w-full sm:w-auto">See OCR Flow</Button>
                  </Link>
                </div>

                {error ? (
                  <div className="rounded-xl border border-danger/30 bg-danger/12 px-4 py-3 text-sm text-danger">
                    {error}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  {homepagePrinciples.map((item) => (
                    <div key={item} className="surface-panel-soft rounded-[1.2rem] px-4 py-3 text-sm text-text-secondary">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="surface-panel rounded-[1.7rem] p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(77,163,255,0.92)]">
                    Live Desk
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-text-primary">
                    One board for workers, supervisors, and owners
                  </div>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">
                    The app routes each role into the right desk, then keeps the next action visible instead of buried.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    {homepageSignals.map((item) => (
                      <div key={item.label} className="surface-panel-soft rounded-[1.2rem] p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(77,163,255,0.92)]">
                          {item.label}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-text-primary">{item.title}</div>
                        <div className="mt-2 text-xs leading-5 text-text-secondary">{item.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {homepageSteps.map((item) => (
              <Card key={item.step}>
                <CardHeader>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(77,163,255,0.92)]">
                    Step {item.step}
                  </div>
                  <CardTitle className="mt-3 text-2xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-text-secondary">{item.detail}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="surface-panel rounded-[2rem] p-5 md:p-7">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(77,163,255,0.92)]">
                  Launch Faster
                </div>
                <div className="text-2xl font-semibold text-text-primary md:text-3xl">
                  Start with the live app, then keep polishing tab by tab.
                </div>
                <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                  Open the workspace now if you already have an account, or create one and move into the factory flow immediately.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/login" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto">Open Workspace</Button>
                </Link>
                <Link href="/register" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">Create Account</Button>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 md:px-6">
      <div className="absolute inset-0">
        <div className="absolute left-[12%] top-[12%] h-44 w-44 rounded-full bg-[rgba(77,163,255,0.16)] blur-3xl" />
        <div className="absolute right-[14%] top-[14%] h-48 w-48 rounded-full bg-[rgba(20,184,166,0.12)] blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-[80vh] max-w-4xl items-center justify-center">
        <Card variant="elevated" className="w-full max-w-2xl overflow-hidden">
          <CardHeader>
            <div className="surface-pill inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(77,163,255,0.92)]">
              Welcome back
            </div>
            <CardTitle className="mt-4 text-3xl md:text-4xl">
              Opening {destinationLabel(destination)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Your role-based home is ready. If the redirect takes longer than expected, continue directly below.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="surface-panel-soft rounded-[1.25rem] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(77,163,255,0.92)]">
                  Role
                </div>
                <div className="mt-2 text-lg font-semibold text-text-primary">{user.role}</div>
              </div>
              <div className="surface-panel-soft rounded-[1.25rem] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(77,163,255,0.92)]">
                  Factory
                </div>
                <div className="mt-2 text-lg font-semibold text-text-primary">{user.factory_name || "Workspace"}</div>
              </div>
              <div className="surface-panel-soft rounded-[1.25rem] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(77,163,255,0.92)]">
                  Next
                </div>
                <div className="mt-2 text-lg font-semibold text-text-primary">Continue</div>
              </div>
            </div>
            <Link href={destination} className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">Continue to workspace</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
