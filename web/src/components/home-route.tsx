"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHomeDestination } from "@/lib/role-navigation";
import { useSession } from "@/lib/use-session";

const trustSignals = [
  {
    value: "5 min",
    label: "to launch the first floor workflow",
  },
  {
    value: "1 lane",
    label: "from capture to review to report",
  },
  {
    value: "4 roles",
    label: "workers, supervisors, managers, owners",
  },
  {
    value: "Mobile",
    label: "built first for the factory floor",
  },
];

const featureCards = [
  {
    icon: ClipboardCheck,
    label: "Floor capture",
    title: "Attendance, shift entry, and OCR stay in one worker-ready flow",
    detail:
      "Workers use the phone they already carry instead of bouncing between paper registers, chat messages, and side notes.",
  },
  {
    icon: Shield,
    label: "Review lane",
    title: "Supervisors clear exceptions before they become reporting mistakes",
    detail:
      "Attendance review, OCR verification, and approvals stay connected so bad data gets stopped before it spreads.",
  },
  {
    icon: BarChart3,
    label: "Trusted reporting",
    title: "Managers export from reviewed rows instead of cleanup work",
    detail:
      "Once the floor data is captured and reviewed, reports, exports, and owner visibility become much cleaner and faster.",
  },
];

const workflowLanes = [
  {
    step: "01",
    title: "Capture from the floor",
    detail:
      "Punch attendance, finish entry, and scan paper registers from one mobile-ready system.",
  },
  {
    step: "02",
    title: "Review what actually needs trust",
    detail:
      "Supervisors only step into exceptions, approvals, and OCR corrections instead of checking everything manually.",
  },
  {
    step: "03",
    title: "Push trusted data into reports",
    detail:
      "Reports and exports come from the same verified rows the floor already approved.",
  },
  {
    step: "04",
    title: "Give every role a cleaner desk",
    detail:
      "Workers stay fast, supervisors stay focused, and managers keep context without drowning in admin screens.",
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
      <main className="relative min-h-screen overflow-hidden px-4 py-6 md:px-6 md:py-8 xl:px-8 2xl:px-10">
        <div className="absolute inset-0">
          <div className="absolute left-[-4rem] top-8 h-48 w-48 rounded-full bg-[rgba(77,163,255,0.14)] blur-3xl" />
          <div className="absolute right-[-3rem] top-20 h-56 w-56 rounded-full bg-[rgba(20,184,166,0.12)] blur-3xl" />
          <div className="absolute bottom-[-4rem] left-[30%] h-64 w-64 rounded-full bg-[rgba(245,158,11,0.08)] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-[96rem] space-y-8">
          <header className="surface-panel-soft flex flex-col gap-4 rounded-[1.6rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(77,163,255,0.24),rgba(20,184,166,0.2))] text-[rgba(214,237,255,0.96)]">
                <Factory className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-[-0.02em] text-text-primary">FactoryNerve</div>
                <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Factory-first operating system</div>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link href="/login" className="w-full sm:w-auto">
                <Button variant="ghost" className="w-full sm:w-auto">Sign in</Button>
              </Link>
              <Link href="/register" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">Start free</Button>
              </Link>
            </div>
          </header>

          <section className="relative isolate overflow-hidden rounded-[2.35rem] border border-[rgba(214,228,255,0.14)] bg-[linear-gradient(140deg,rgba(8,16,28,0.94),rgba(11,22,38,0.82)_52%,rgba(6,16,28,0.96))] px-5 py-6 shadow-[0_34px_90px_rgba(2,8,18,0.42)] md:px-7 md:py-7 xl:px-8 xl:py-8 2xl:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(77,163,255,0.2),transparent_26%),radial-gradient(circle_at_86%_12%,rgba(20,184,166,0.16),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_28%)]" />
            <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:items-center">
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-[rgba(77,163,255,0.26)] bg-[rgba(77,163,255,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(166,211,255,0.96)]">
                    FactoryNerve
                  </span>
                  <span className="rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                    Built for daily factory operations
                  </span>
                </div>

                <div className="space-y-5">
                  <h1 className="max-w-[40rem] text-[clamp(2.8rem,4.4vw,4.7rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-white">
                    Replace paper follow-up with one cleaner factory workflow.
                  </h1>
                  <p className="max-w-[39rem] text-base leading-7 text-[rgba(224,231,255,0.78)] md:text-lg">
                    FactoryNerve gives workers, supervisors, managers, and owners one connected system for attendance, shift entry, OCR, approvals, and trusted reports.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link href="/register" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto">
                      Start free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="#workflow" className="w-full sm:w-auto">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto">See how it works</Button>
                  </Link>
                  <Link href="/login" className="w-full sm:w-auto">
                    <Button variant="ghost" size="lg" className="w-full sm:w-auto">Sign in</Button>
                  </Link>
                </div>

                {error ? (
                  <div className="rounded-xl border border-danger/30 bg-danger/12 px-4 py-3 text-sm text-danger">
                    {error}
                  </div>
                ) : null}

                <div className="grid gap-2 text-sm text-[rgba(224,231,255,0.78)] sm:grid-cols-2">
                  {[
                    "Workers use one phone-ready desk instead of paper and chat.",
                    "Supervisors clear exceptions before numbers reach reports.",
                    "Managers export from trusted data, not cleanup work.",
                    "Each role only sees the power it actually needs.",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-[1rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[rgba(112,184,255,0.96)]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mx-auto w-full max-w-[62rem]">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(17rem,0.68fr)]">
                  <div className="rounded-[2rem] border border-[rgba(215,231,255,0.14)] bg-[linear-gradient(180deg,rgba(20,30,46,0.92),rgba(10,18,29,0.96))] p-4 shadow-[0_28px_70px_rgba(3,8,18,0.45)] md:p-5">
                    <div className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.08)] pb-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(112,184,255,0.96)]">
                          Operations board
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white">One place to capture, review, and report</div>
                      </div>
                      <div className="rounded-full border border-[rgba(77,163,255,0.24)] bg-[rgba(77,163,255,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(191,225,255,0.96)]">
                        Network live
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1fr)]">
                      <div className="rounded-[1.65rem] border border-[rgba(226,237,255,0.18)] bg-[linear-gradient(180deg,rgba(12,23,36,0.95),rgba(7,13,22,0.98))] p-4 shadow-[0_24px_58px_rgba(2,8,18,0.5)]">
                        <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-[rgba(255,255,255,0.14)]" />
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(112,184,255,0.96)]">
                          Worker desk
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">Punch in and keep the shift moving</div>
                        <div className="mt-4 rounded-[1.35rem] border border-[rgba(77,163,255,0.18)] bg-[rgba(77,163,255,0.1)] p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(166,211,255,0.96)]">
                            Next action
                          </div>
                          <div className="mt-3 text-2xl font-semibold text-white">Punch in</div>
                          <div className="mt-2 text-sm leading-6 text-[rgba(224,231,255,0.76)]">
                            Attendance, shift timing, and history stay visible on one screen.
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between rounded-[1rem] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-xs text-text-secondary">
                          <span>Shift status visible</span>
                          <span className="font-semibold uppercase tracking-[0.16em] text-white">Synced</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          {[
                            ["Attendance", "Live", "Punch and shift status stay visible."],
                            ["Review", "Queue", "Exceptions move into one approval lane."],
                            ["Reports", "Trusted", "Exports follow reviewed rows."],
                          ].map(([label, value, detail]) => (
                            <div key={label} className="rounded-[1.25rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">{label}</div>
                              <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
                              <div className="mt-2 text-xs leading-5 text-text-secondary">{detail}</div>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(112,184,255,0.96)]">
                              Why teams switch
                            </div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                              One source of truth
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                            {[
                              ["Capture", "Workers move faster without paper follow-up."],
                              ["Review", "Supervisors catch the blockers that matter now."],
                              ["Report", "Managers export from trusted rows instead of cleanup work."],
                            ].map(([label, detail]) => (
                              <div
                                key={label}
                                className="rounded-[1rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-3 py-3"
                              >
                                <div className="text-sm font-semibold text-white">{label}</div>
                                <div className="mt-1 text-sm leading-6 text-text-secondary">{detail}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[1.75rem] border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(180deg,rgba(17,31,49,0.94),rgba(9,18,29,0.96))] p-5 shadow-[0_18px_44px_rgba(3,8,18,0.42)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(112,184,255,0.96)]">
                        OCR lane
                      </div>
                      <div className="mt-3 text-lg font-semibold text-white">Paper register to verified row</div>
                      <div className="mt-4 space-y-2">
                        {[
                          "Capture the image",
                          "Verify only the extracted rows that need correction",
                          "Push trusted data into reports",
                        ].map((detail) => (
                          <div key={detail} className="rounded-[1rem] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-sm leading-6 text-text-secondary">
                            {detail}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-[rgba(77,163,255,0.16)] bg-[linear-gradient(180deg,rgba(77,163,255,0.1),rgba(77,163,255,0.03))] p-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(166,211,255,0.96)]">
                        Leadership context
                      </div>
                      <div className="mt-3 text-lg font-semibold text-white">Owners and managers see a cleaner operating picture</div>
                      <div className="mt-2 text-sm leading-6 text-[rgba(224,231,255,0.74)]">
                        Reports, exports, and factory risk become easier to read once capture and review stay connected.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {trustSignals.map((item) => (
              <div key={item.label} className="surface-panel-soft rounded-[1.2rem] px-4 py-4">
                <div className="text-2xl font-semibold tracking-[-0.03em] text-white">{item.value}</div>
                <div className="mt-2 text-sm leading-6 text-text-secondary">{item.label}</div>
              </div>
            ))}
          </section>

          <section id="workflow" className="grid gap-4 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
            <div className="surface-panel-strong rounded-[2rem] p-5 md:p-7">
              <div className="max-w-2xl space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(112,184,255,0.96)]">
                  Why factories move off paper
                </div>
                <div className="text-2xl font-semibold leading-tight text-white md:text-3xl">
                  The product stays simple because the work follows one clear operating path.
                </div>
                <p className="text-sm leading-6 text-text-secondary">
                  FactoryNerve works best when teams stop bouncing between paper, chats, Excel, and manual follow-up. Capture, review, and reporting stay connected instead.
                </p>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {featureCards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] p-5"
                    >
                      <div className="inline-flex rounded-2xl border border-[rgba(77,163,255,0.18)] bg-[rgba(77,163,255,0.1)] p-3 text-[rgba(166,211,255,0.96)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(112,184,255,0.96)]">
                        {item.label}
                      </div>
                      <div className="mt-3 text-xl font-semibold leading-tight text-white">{item.title}</div>
                      <p className="mt-3 text-sm leading-6 text-text-secondary">{item.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="surface-panel rounded-[1.8rem] p-5 md:p-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(112,184,255,0.96)]">
                  How teams start
                </div>
                <div className="mt-3 text-2xl font-semibold leading-tight text-white">
                  Launch the worker flow first, then grow into trusted reporting.
                </div>
                <div className="mt-5 space-y-3">
                  {workflowLanes.map((item) => (
                    <div
                      key={item.step}
                      className="grid gap-3 rounded-[1.3rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] p-4 sm:grid-cols-[auto_minmax(0,1fr)]"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(77,163,255,0.12)] text-sm font-semibold uppercase tracking-[0.18em] text-[rgba(166,211,255,0.96)]">
                        {item.step}
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-white">{item.title}</div>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ["Operators", "Fast shift work on mobile"],
                  ["Supervisors", "One clear review lane"],
                  ["Managers", "Daily context without spreadsheet chasing"],
                  ["Owners", "Leadership visibility without digging"],
                ].map(([label, detail]) => (
                  <div key={label} className="surface-panel rounded-[1.6rem] p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(112,184,255,0.96)]">
                      {label}
                    </div>
                    <div className="mt-3 text-lg font-semibold leading-tight text-white">{detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="surface-panel rounded-[2rem] p-5 md:p-7">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(112,184,255,0.96)]">
                  Start the factory flow
                </div>
                <div className="text-2xl font-semibold leading-tight text-white md:text-3xl">
                  Give first-time users a clean start instead of sending them straight into complexity.
                </div>
                <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                  Create an account to launch the mobile-ready workflow, or sign in if your team is already live inside FactoryNerve.
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
