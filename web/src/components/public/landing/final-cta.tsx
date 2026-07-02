import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="relative px-4 py-20 sm:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(197,109,45,0.08),transparent_60%)]" />
      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Your factory runs on data. Make it trusted.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-400">
          Start your 14-day free pilot with full access to all features. No credit card required.
          No long-term lock-in. Go live in 2–3 days.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-[linear-gradient(135deg,rgba(197,109,45,0.95),rgba(197,109,45,0.55))] px-8 py-3.5 text-sm font-semibold text-[#06111c] shadow-[0_14px_30px_rgba(197,109,45,0.28)] transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_18px_40px_rgba(197,109,45,0.38)]"
          >
            Start free trial
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-8 py-3.5 text-sm font-semibold text-slate-200 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
          >
            Talk to sales
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">No credit card required &middot; Cancel anytime &middot; Annual plans save 17%</p>
      </div>
    </section>
  );
}
