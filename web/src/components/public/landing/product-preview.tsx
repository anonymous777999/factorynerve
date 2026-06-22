import Link from "next/link";

export default function ProductPreview() {
  return (
    <section className="relative px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to see it with your data?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            The best way to evaluate Factory Nerve is to use it with your actual production
            data. We&rsquo;ll set up your workspace in one session.
          </p>
        </div>

        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(23,32,40,0.8),rgba(13,18,24,0.95))] p-8 shadow-[0_24px_60px_rgba(2,6,23,0.4)] sm:p-10">
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/15 bg-amber-500/10 text-sm font-bold text-amber-300">
                  1
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white">Share your setup</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Tell us about your factory, shifts, and team. We configure everything for you.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/15 bg-amber-500/10 text-sm font-bold text-amber-300">
                  2
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white">Start capturing</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Your team starts logging production, attendance, and inventory — on paper or
                  directly in the app.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/15 bg-amber-500/10 text-sm font-bold text-amber-300">
                  3
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white">See the difference</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Within days, you&rsquo;ll have structured data, dashboards, and insights
                  from your own operations.
                </p>
              </div>
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-[linear-gradient(135deg,rgba(197,109,45,0.95),rgba(197,109,45,0.55))] px-7 py-3.5 text-sm font-semibold text-[#06111c] shadow-[0_14px_30px_rgba(197,109,45,0.28)] transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_18px_40px_rgba(197,109,45,0.38)]"
              >
                Start your pilot — free
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <p className="mt-3 text-xs text-slate-500">
                No credit card. No commitment. Your data stays yours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
