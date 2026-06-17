export default function ProductPreview() {
  return (
    <section className="relative px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
            See it in action
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            A single interface connecting capture, review, reporting, and intelligence across
            your entire operation.
          </p>
        </div>

        <div className="relative mx-auto max-w-5xl">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(23,32,40,0.8),rgba(13,18,24,0.95))] shadow-[0_24px_60px_rgba(2,6,23,0.4)]">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/50" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/50" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/50" />
              </div>
              <div className="ml-4 rounded-md border border-white/5 bg-white/[0.03] px-3 py-1 text-xs text-slate-500">app.dpr.ai</div>
            </div>
            <div className="flex min-h-[320px] items-center justify-center px-6 py-16 sm:min-h-[400px]">
              <div className="text-center">
                <svg viewBox="0 0 24 24" className="mx-auto h-10 w-10 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <p className="mt-4 text-sm text-slate-500">Product demo</p>
                <p className="mt-1 text-xs text-slate-600">Screenshots and walkthrough coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
