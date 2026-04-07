import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(62,166,255,0.14),transparent_34%),linear-gradient(180deg,rgba(10,14,22,0.98),rgba(14,18,28,0.96))] px-4 py-6 pb-24 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.92)] p-6 shadow-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">
            Offline Mode
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-[var(--text)]">
            FactoryNerve is offline, but local work can still continue.
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            If you already opened Shift Entry, keep working there. Drafts stay on this device and queued submissions
            will sync automatically the moment your connection returns.
          </p>
          <div className="mt-6 rounded-2xl border border-[rgba(62,166,255,0.2)] bg-[rgba(62,166,255,0.08)] p-4 text-sm leading-6 text-[var(--text)]/90">
            Recommended: reopen <span className="font-semibold">Shift Entry</span> after the shell reconnects, then use
            <span className="font-semibold"> Sync Now</span> only if queued work does not clear automatically.
          </div>
          <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
            <Link href="/entry" className="sm:w-auto">
              <span className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(62,166,255,0.3)] transition hover:brightness-110">
                Open Shift Entry
              </span>
            </Link>
            <Link href="/dashboard" className="sm:w-auto">
              <span className="inline-flex w-full items-center justify-center rounded-full border border-white/12 bg-[rgba(8,12,20,0.42)] px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[rgba(62,166,255,0.32)] hover:bg-[rgba(20,24,36,0.78)]">
                Open Dashboard
              </span>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.6rem] border border-emerald-400/25 bg-[rgba(34,197,94,0.08)] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/80">
              Still Works
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-emerald-50/90">
              <div>Local DPR drafts stay in this browser.</div>
              <div>Queued entries wait safely for reconnect.</div>
              <div>The installed PWA shell can still reopen saved work.</div>
            </div>
          </div>
          <div className="rounded-[1.6rem] border border-amber-400/25 bg-[rgba(245,158,11,0.08)] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-100/80">
              Needs Connection
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-amber-50/90">
              <div>Attendance punch actions</div>
              <div>Live reports, approvals, and queue updates</div>
              <div>OCR extraction, verification sync, and server-backed refresh</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
