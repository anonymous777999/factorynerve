"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHomeDestination } from "@/lib/role-navigation";
import { useSession } from "@/lib/use-session";

const heroHighlights = [
  {
    value: "Attendance",
    label: "Punch, view status, and close shifts without menu-hunting.",
  },
  {
    value: "OCR",
    label: "Turn paper registers into reviewable rows instead of retyping them.",
  },
  {
    value: "Reports",
    label: "Move from live signals to trusted exports from one operating system.",
  },
];

const painToProduct = [
  {
    title: "Paper attendance slows the floor",
    detail: "FactoryNerve keeps punch status, history, and shift context visible on the phone workers already carry.",
  },
  {
    title: "OCR should not create another review headache",
    detail: "Capture, verify, and approve registers in one lane before numbers reach reports.",
  },
  {
    title: "Supervisors need one board, not five chats",
    detail: "Alerts, queues, approvals, and exports stay connected instead of scattered across WhatsApp and sheets.",
  },
];

const roleCards = [
  {
    role: "Operators",
    title: "Fast shift work on mobile",
    detail: "Punch attendance, capture OCR, and finish entry without getting dragged into admin screens.",
  },
  {
    role: "Supervisors",
    title: "Review the issues that matter now",
    detail: "Clear attendance, OCR, and queue blockers before the next shift loses momentum.",
  },
  {
    role: "Managers",
    title: "Run the day from one board",
    detail: "Watch operations, move into reports, and stay on top of trust signals without spreadsheet chasing.",
  },
  {
    role: "Owners",
    title: "Keep factory context without digging",
    detail: "See network-level performance, risk, and reporting from a cleaner leadership desk.",
  },
];

const productPreview = [
  {
    label: "01",
    title: "Capture",
    detail: "Attendance, entry, and OCR start from the same mobile-ready system.",
    callout: "Workers stay in flow",
  },
  {
    label: "02",
    title: "Review",
    detail: "Supervisors verify exceptions before bad data spreads through the business.",
    callout: "Trust before export",
  },
  {
    label: "03",
    title: "Report",
    detail: "Managers and accountants export from the same trusted data the floor already approved.",
    callout: "One source of truth",
  },
];

const operatingSystemProof = [
  "Mobile-first for real factory floors",
  "Offline-aware on weak networks",
  "Role-based desks for every team",
  "Clear review lanes before reports",
];

const gettingStarted = [
  {
    step: "Start with the worker flow",
    detail: "Open attendance, shift entry, or OCR first so the floor sees value immediately.",
  },
  {
    step: "Give supervisors one review lane",
    detail: "Let approvals, attendance review, and OCR verification live in one obvious queue.",
  },
  {
    step: "Route management into trusted reports",
    detail: "Reports, exports, and owner visibility become much easier when review is built in.",
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
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(77,163,255,0.28),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(20,184,166,0.18),transparent_28%),linear-gradient(118deg,rgba(6,14,24,0.8)_4%,rgba(6,14,24,0.38)_48%,rgba(6,14,24,0.74)_100%)]" />
            <div className="relative z-10 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] xl:items-end">
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <span className="surface-pill rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(77,163,255,0.92)]">
                    FactoryNerve
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                    Factory-first operating system
                  </span>
                </div>

                <div className="space-y-4">
                  <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.04em] md:text-5xl xl:text-6xl">
                    Replace paper, WhatsApp, and scattered sheets with one factory-ready flow.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-text-secondary md:text-lg">
                    FactoryNerve gives workers, supervisors, managers, and owners one connected system for attendance, shift entry, OCR, approvals, and reports.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {heroHighlights.map((item) => (
                    <div key={item.value} className="surface-panel-soft rounded-[1.25rem] px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(77,163,255,0.92)]">
                        {item.value}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-text-secondary">{item.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link href="/register" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto">Start free</Button>
                  </Link>
                  <Link href="/login" className="w-full sm:w-auto">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto">Sign in</Button>
                  </Link>
                  <Link href="/login?next=%2Fdashboard" className="w-full sm:w-auto">
                    <Button variant="ghost" size="lg" className="w-full sm:w-auto">See product flow</Button>
                  </Link>
                </div>

                {error ? (
                  <div className="rounded-xl border border-danger/30 bg-danger/12 px-4 py-3 text-sm text-danger">
                    {error}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {operatingSystemProof.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.045)] px-3 py-1.5 text-xs font-medium text-text-secondary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="surface-panel rounded-[1.75rem] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(77,163,255,0.92)]">
                        Product Preview
                      </div>
                      <div className="mt-3 text-2xl font-semibold text-text-primary">
                        One operating lane from capture to report
                      </div>
                    </div>
                    <div className="rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
                      Live flow
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {productPreview.map((item) => (
                      <div key={item.label} className="surface-panel-soft rounded-[1.25rem] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(77,163,255,0.92)]">
                            {item.label}
                          </div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
                            {item.callout}
                          </div>
                        </div>
                        <div className="mt-3 text-lg font-semibold text-text-primary">{item.title}</div>
                        <div className="mt-2 text-sm leading-6 text-text-secondary">{item.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {painToProduct.map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(77,163,255,0.92)]">
                    Why teams switch
                  </div>
                  <CardTitle className="mt-3 text-2xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-text-secondary">{item.detail}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.95fr)]">
            <div className="surface-panel rounded-[2rem] p-5 md:p-7">
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(77,163,255,0.92)]">
                  Built for every desk
                </div>
                <div className="text-2xl font-semibold text-text-primary md:text-3xl">
                  The system changes by role so users only see the power they actually need.
                </div>
                <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                  Operators stay fast, supervisors get review tools, managers get one board, and owners keep leadership context without dragging everyone into the same UI.
                </p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {roleCards.map((item) => (
                  <div key={item.role} className="surface-panel-soft rounded-[1.25rem] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(77,163,255,0.92)]">
                      {item.role}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-text-primary">{item.title}</div>
                    <div className="mt-2 text-sm leading-6 text-text-secondary">{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-panel-strong rounded-[2rem] p-5 md:p-7">
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(77,163,255,0.92)]">
                  How teams start
                </div>
                <div className="text-2xl font-semibold text-text-primary">
                  Launch the live workflow first, then grow into reporting.
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {gettingStarted.map((item, index) => (
                  <div key={item.step} className="surface-panel-soft rounded-[1.25rem] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
                      Phase {index + 1}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-text-primary">{item.step}</div>
                    <div className="mt-2 text-sm leading-6 text-text-secondary">{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="surface-panel rounded-[2rem] p-5 md:p-7">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(77,163,255,0.92)]">
                  Start the factory flow
                </div>
                <div className="text-2xl font-semibold text-text-primary md:text-3xl">
                  Give first-time users a clean start instead of sending them straight into complexity.
                </div>
                <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                  Create an account to open the mobile-first workflow, or sign in if your team is already live inside FactoryNerve.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/register" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto">Create account</Button>
                </Link>
                <Link href="/login" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">Open workspace</Button>
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
