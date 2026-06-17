import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative flex min-h-[85vh] items-center justify-center overflow-hidden px-4 pt-20 sm:pt-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-amber-500/8 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-teal-400/6 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 rounded-full bg-amber-400/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/15 bg-amber-500/8 px-4 py-1.5 text-xs font-medium text-amber-200/80">
          <span className="flex h-2 w-2 rounded-full bg-amber-400" />
          AI-Native Factory Operating System
        </div>

        <h1 className="bg-[linear-gradient(180deg,#fff_40%,#ab9f93_100%)] bg-clip-text text-4xl font-bold leading-[1.1] tracking-[-0.04em] text-transparent sm:text-6xl sm:leading-[1.08] md:text-7xl">
          Factory trust infrastructure for teams that operate on paper, WhatsApp, and instinct.
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
          DPR.ai turns daily production records from scattered paper and messages into trusted,
          auditable business operations — in one mobile-first platform built for the Indian
          manufacturing floor.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/access"
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-[linear-gradient(135deg,rgba(197,109,45,0.95),rgba(197,109,45,0.55))] px-7 py-3.5 text-sm font-semibold text-[#06111c] shadow-[0_14px_30px_rgba(197,109,45,0.28)] transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_18px_40px_rgba(197,109,45,0.38)]"
          >
            Open your workspace
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <Link
            href="/plans"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-slate-200 shadow-[0_8px_24px_rgba(2,6,23,0.2)] transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
          >
            See plans and pricing
          </Link>
        </div>

        <p className="mt-4 text-xs text-slate-500">No credit card required. Free 14-day pilot with full access.</p>
      </div>
    </section>
  );
}
