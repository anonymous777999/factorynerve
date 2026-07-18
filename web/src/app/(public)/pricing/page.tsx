import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090d14] px-4">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--accent)]/20 bg-[linear-gradient(135deg,rgba(197,109,45,0.24),rgba(197,109,45,0.10))] text-2xl font-bold text-[var(--accent)]">
          F
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Pricing
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
          Explore our plans and add-ons built for real factory operations.
          Start free for 14 days — no credit card required.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/plans"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/20 bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(197,109,45,0.25)] transition hover:brightness-110"
          >
            View Plans
          </Link>
          <Link
            href="/access"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-white/[0.02] px-6 py-3 text-sm font-semibold text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:-translate-y-0.5 hover:border-[var(--accent-soft)] hover:bg-[rgba(197,109,45,0.08)]"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
