import Link from "next/link";
import { pricingTiers } from "./data";

function CheckIcon() {
  return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function PricingPreview() {
  return (
    <section id="pricing" className="relative scroll-mt-20 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Plans built for real factory operations
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            Start free for 14 days with full access. Upgrade only when you see operational impact.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-6 backdrop-blur-sm ${
                tier.highlight
                  ? "border-amber-500/20 bg-[linear-gradient(180deg,rgba(197,109,45,0.12),rgba(197,109,45,0.04))] shadow-[0_16px_40px_rgba(197,109,45,0.12)]"
                  : "border-white/5 bg-[rgba(23,32,40,0.4)]"
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                  Most popular
                </div>
              )}
              <div className="text-sm font-semibold text-white">{tier.name}</div>
              <div className="mt-3">
                <span className="text-3xl font-bold tracking-tight text-white">{tier.price}</span>
                {tier.period && <span className="ml-1 text-sm text-slate-500">{tier.period}</span>}
              </div>
              <p className="mt-2 text-xs text-slate-400">{tier.tagline}</p>
              <ul className="mt-4 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/plans"
                className={`mt-6 flex items-center justify-center rounded-full px-5 py-2.5 text-xs font-semibold transition ${
                  tier.highlight
                    ? "border border-amber-500/20 bg-[linear-gradient(135deg,rgba(197,109,45,0.9),rgba(197,109,45,0.55))] text-[#06111c] shadow-[0_8px_20px_rgba(197,109,45,0.2)] hover:brightness-110"
                    : "border border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-slate-500">
          Annual billing saves 17%. All plans include 99.9%+ uptime SLA, daily backups, and enterprise-grade security.
          {" "}<Link href="/plans" className="text-amber-300 hover:underline">View full pricing &rarr;</Link>
        </p>
      </div>
    </section>
  );
}
