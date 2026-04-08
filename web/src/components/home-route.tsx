"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHomeDestination } from "@/lib/role-navigation";
import { useSession } from "@/lib/use-session";

const trustSignals = [
  {
    label: "Mobile-first",
    title: "Made for the phone workers already use",
  },
  {
    label: "Offline-aware",
    title: "Handles weak factory networks more gracefully",
  },
  {
    label: "Role-based",
    title: "Each desk gets only the power it needs",
  },
  {
    label: "Review-first",
    title: "Bad data gets caught before it reaches reports",
  },
];

const workflowLanes = [
  {
    step: "01",
    title: "Capture on the floor",
    detail: "Attendance, shift entry, and OCR start from one mobile-ready workflow instead of separate tools.",
    accent: "Workers stay in motion",
  },
  {
    step: "02",
    title: "Review in one lane",
    detail: "Supervisors clear approvals, OCR issues, and attendance exceptions before the next shift loses time.",
    accent: "Trust before export",
  },
  {
    step: "03",
    title: "Report from trusted data",
    detail: "Managers and accountants move into exports after the floor data has already been verified.",
    accent: "One source of truth",
  },
];

const roleOutcomes = [
  {
    role: "Operators",
    title: "Finish the shift faster",
    detail: "Punch attendance, capture OCR, and complete entry without getting dragged into admin complexity.",
  },
  {
    role: "Supervisors",
    title: "See the blockers that matter now",
    detail: "Clear review items before they spread into production delays, confusion, or bad reporting.",
  },
  {
    role: "Managers",
    title: "Run the day from one board",
    detail: "Move from alerts to reports without depending on WhatsApp follow-up and spreadsheet chasing.",
  },
  {
    role: "Owners",
    title: "Keep leadership context without digging",
    detail: "Watch risk, performance, and reporting from a cleaner desk instead of fragmented updates.",
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

        <div className="relative mx-auto max-w-[92rem] space-y-8">
          <header className="surface-panel-soft flex flex-col gap-4 rounded-[1.6rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(77,163,255,0.24),rgba(20,184,166,0.2))] text-sm font-semibold uppercase tracking-[0.2em] text-[rgba(214,237,255,0.96)]">
                FN
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

          <section className="relative isolate overflow-hidden rounded-[2.2rem] border border-[rgba(214,228,255,0.14)] bg-[linear-gradient(140deg,rgba(8,16,28,0.92),rgba(11,22,38,0.76)_52%,rgba(6,16,28,0.94))] px-5 py-6 shadow-[0_34px_90px_rgba(2,8,18,0.42)] md:px-7 md:py-7 xl:px-9 xl:py-9 2xl:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(77,163,255,0.2),transparent_26%),radial-gradient(circle_at_86%_12%,rgba(20,184,166,0.16),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_28%)]" />
            <div className="relative z-10 grid gap-10 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] xl:items-center 2xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-[rgba(77,163,255,0.26)] bg-[rgba(77,163,255,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(166,211,255,0.96)]">
                    FactoryNerve
                  </span>
                  <span className="rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                    Built for daily factory operations
                  </span>
                </div>

                <div className="space-y-4">
                  <h1 className="max-w-[40rem] text-4xl font-semibold leading-[0.98] tracking-[-0.05em] text-white md:text-5xl xl:text-[4.8rem] 2xl:text-[5.35rem]">
                    Run the factory from one mobile-ready system.
                  </h1>
                  <p className="max-w-[36rem] text-base leading-7 text-[rgba(224,231,255,0.78)] md:text-lg xl:text-[1.08rem]">
                    Replace paper registers, WhatsApp follow-up, and scattered Excel sheets with one connected workflow for attendance, shift entry, OCR, approvals, and reports.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link href="/register" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto">Start free</Button>
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

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.045)] px-3 py-1.5 text-xs font-medium text-text-secondary">
                    Attendance desk
                  </span>
                  <span className="rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.045)] px-3 py-1.5 text-xs font-medium text-text-secondary">
                    OCR review lane
                  </span>
                  <span className="rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.045)] px-3 py-1.5 text-xs font-medium text-text-secondary">
                    Reports from trusted data
                  </span>
                </div>
              </div>

              <div className="relative mx-auto min-h-[32rem] w-full max-w-[52rem] xl:min-h-[35rem] 2xl:max-w-[58rem] 2xl:min-h-[37rem]">
                <div className="absolute inset-x-4 top-8 rounded-[2rem] border border-[rgba(215,231,255,0.14)] bg-[linear-gradient(180deg,rgba(20,30,46,0.92),rgba(10,18,29,0.96))] p-4 shadow-[0_28px_70px_rgba(3,8,18,0.45)] md:inset-x-6 md:p-5 2xl:top-10">
                  <div className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.08)] pb-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(112,184,255,0.96)]">
                        Today Board
                      </div>
                      <div className="mt-1 text-lg font-semibold text-white">One board for the full day</div>
                    </div>
                    <div className="rounded-full border border-[rgba(77,163,255,0.24)] bg-[rgba(77,163,255,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(191,225,255,0.96)]">
                      Network live
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(17rem,0.82fr)] 2xl:grid-cols-[minmax(0,1.16fr)_minmax(18rem,0.84fr)]">
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[1.25rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Attendance</div>
                          <div className="mt-2 text-2xl font-semibold text-white">Live</div>
                          <div className="mt-2 text-xs leading-5 text-text-secondary">Punch and shift status stay visible.</div>
                        </div>
                        <div className="rounded-[1.25rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">OCR</div>
                          <div className="mt-2 text-2xl font-semibold text-white">Review</div>
                          <div className="mt-2 text-xs leading-5 text-text-secondary">Registers move into one approval lane.</div>
                        </div>
                        <div className="rounded-[1.25rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Reports</div>
                          <div className="mt-2 text-2xl font-semibold text-white">Trusted</div>
                          <div className="mt-2 text-xs leading-5 text-text-secondary">Exports follow reviewed data.</div>
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(112,184,255,0.96)]">
                            Attention now
                          </div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                            Review queue connected
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {[
                            ["Missed punches", "Visible to supervisors"],
                            ["OCR exceptions", "Approved before reports"],
                            ["Exports", "Pulled from trusted rows"],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="flex items-center justify-between gap-4 rounded-[1rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-3 py-3"
                            >
                              <div className="text-sm font-medium text-white">{label}</div>
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(112,184,255,0.96)]">
                          Supervisor lane
                        </div>
                        <div className="mt-3 text-lg font-semibold text-white">Clear the right blockers fast</div>
                        <div className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
                          <div className="flex items-center justify-between gap-3">
                            <span>Attendance review</span>
                            <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-2 py-1 text-[11px] uppercase tracking-[0.16em]">Ready</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>OCR verify</span>
                            <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-2 py-1 text-[11px] uppercase tracking-[0.16em]">Linked</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Approvals queue</span>
                            <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-2 py-1 text-[11px] uppercase tracking-[0.16em]">Live</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-[rgba(77,163,255,0.16)] bg-[linear-gradient(180deg,rgba(77,163,255,0.1),rgba(77,163,255,0.03))] p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(166,211,255,0.96)]">
                          Owner context
                        </div>
                        <div className="mt-3 text-lg font-semibold text-white">Leadership sees the trusted picture</div>
                        <div className="mt-2 text-sm leading-6 text-[rgba(224,231,255,0.74)]">
                          Reports, exports, and factory risk become easier to read once capture and review stay connected.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 w-[15.5rem] rounded-[2rem] border border-[rgba(226,237,255,0.18)] bg-[linear-gradient(180deg,rgba(12,23,36,0.95),rgba(7,13,22,0.98))] p-4 shadow-[0_24px_58px_rgba(2,8,18,0.5)] md:w-[17rem] 2xl:w-[18rem]">
                  <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-[rgba(255,255,255,0.14)]" />
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(112,184,255,0.96)]">
                    Worker view
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">Attendance desk</div>
                  <div className="mt-4 rounded-[1.35rem] border border-[rgba(77,163,255,0.18)] bg-[rgba(77,163,255,0.1)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(166,211,255,0.96)]">
                      Next action
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-white">Punch in</div>
                    <div className="mt-2 text-sm leading-6 text-[rgba(224,231,255,0.76)]">
                      Shift status, timing, and history stay in one screen.
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-[1rem] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-xs text-text-secondary">
                    <span>Review updates</span>
                    <span className="font-semibold uppercase tracking-[0.16em] text-white">Synced</span>
                  </div>
                </div>

                <div className="absolute right-0 top-0 w-[14rem] rounded-[1.6rem] border border-[rgba(255,255,255,0.14)] bg-[linear-gradient(180deg,rgba(17,31,49,0.94),rgba(9,18,29,0.96))] p-4 shadow-[0_18px_44px_rgba(3,8,18,0.42)] md:w-[15.5rem] 2xl:w-[16.5rem]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(112,184,255,0.96)]">
                    OCR lane
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">Paper register to verified row</div>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
                    <div className="rounded-[1rem] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5">Capture the image</div>
                    <div className="rounded-[1rem] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5">Verify the extracted rows</div>
                    <div className="rounded-[1rem] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5">Push trusted data into reports</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-3 rounded-[1.85rem] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.035)] p-4 md:grid-cols-2 xl:grid-cols-4">
            {trustSignals.map((item) => (
              <div key={item.label} className="rounded-[1.25rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(112,184,255,0.96)]">
                  {item.label}
                </div>
                <div className="mt-2 text-sm font-medium leading-6 text-text-primary">{item.title}</div>
              </div>
            ))}
          </section>

          <section id="workflow" className="grid gap-4 xl:grid-cols-[minmax(0,1.14fr)_minmax(0,0.86fr)]">
            <div className="surface-panel-strong rounded-[2rem] p-5 md:p-7">
              <div className="max-w-2xl space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(112,184,255,0.96)]">
                  From floor signal to trusted report
                </div>
                <div className="text-2xl font-semibold leading-tight text-white md:text-3xl">
                  One workflow that starts on the floor and ends in a cleaner operating picture.
                </div>
                <p className="text-sm leading-6 text-text-secondary">
                  FactoryNerve is strongest when teams stop bouncing between paper, chats, Excel, and manual follow-up. Capture, review, and reporting stay connected instead.
                </p>
              </div>
              <div className="mt-6 space-y-4">
                {workflowLanes.map((item) => (
                  <div
                    key={item.step}
                    className="grid gap-3 rounded-[1.4rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(77,163,255,0.12)] text-sm font-semibold uppercase tracking-[0.18em] text-[rgba(166,211,255,0.96)]">
                      {item.step}
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xl font-semibold text-white">{item.title}</div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary">{item.accent}</div>
                      </div>
                      <p className="text-sm leading-6 text-text-secondary">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              {roleOutcomes.map((item) => (
                <div key={item.role} className="surface-panel rounded-[1.8rem] p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(112,184,255,0.96)]">
                    {item.role}
                  </div>
                  <div className="mt-3 text-2xl font-semibold leading-tight text-white">{item.title}</div>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">{item.detail}</p>
                </div>
              ))}
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
                  Create an account to start the mobile-ready workflow, or sign in if your team is already live inside FactoryNerve.
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
