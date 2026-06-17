export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.92)] p-8 shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">
          Offline Mode
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-[var(--text)]">
          DPR.ai is temporarily offline, but your entry workflow can keep going.
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
          If you already opened the DPR entry page, keep working there. Drafts stay in this browser and queued submissions
          will sync automatically the moment your connection returns.
        </p>
        <div className="mt-6 rounded-2xl border border-[rgba(62,166,255,0.2)] bg-[rgba(62,166,255,0.08)] p-4 text-sm text-[var(--text)]/90">
          Recommended: reopen <span className="font-semibold">DPR Entry</span> once the shell reconnects, then press
          <span className="font-semibold"> Sync Now</span> only if the queue does not clear automatically.
        </div>
      </div>
    </main>
  );
}
