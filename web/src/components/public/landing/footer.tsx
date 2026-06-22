import Link from "next/link";
import { COMPANY_NAME } from "./data";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/15 bg-amber-500/10 text-xs font-bold text-amber-300">F</div>
              <span className="text-sm font-semibold text-white">Factory Nerve</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">{COMPANY_NAME}<br />4th Floor, Tech Tower, Industrial District<br />Shillong, Meghalaya 793001, India</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Product</div>
              <ul className="mt-3 space-y-2">
                <li><Link href="/plans" className="text-xs text-slate-500 transition hover:text-sky-300">Pricing</Link></li>
                <li><Link href="/faq" className="text-xs text-slate-500 transition hover:text-sky-300">FAQ</Link></li>
                <li><Link href="/contact" className="text-xs text-slate-500 transition hover:text-sky-300">Contact</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Trust</div>
              <ul className="mt-3 space-y-2">
                <li><Link href="/security" className="text-xs text-slate-500 transition hover:text-sky-300">Security</Link></li>
                <li><Link href="/compliance" className="text-xs text-slate-500 transition hover:text-sky-300">Trust Center</Link></li>
                <li><Link href="/sla" className="text-xs text-slate-500 transition hover:text-sky-300">SLA</Link></li>
                <li><Link href="/data-retention" className="text-xs text-slate-500 transition hover:text-sky-300">Data Retention</Link></li>
                <li><Link href="/dpa" className="text-xs text-slate-500 transition hover:text-sky-300">DPA</Link></li>
                <li><Link href="/subprocessors" className="text-xs text-slate-500 transition hover:text-sky-300">Sub-processors</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Legal</div>
              <ul className="mt-3 space-y-2">
                <li><Link href="/privacy" className="text-xs text-slate-500 transition hover:text-sky-300">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-xs text-slate-500 transition hover:text-sky-300">Terms of Service</Link></li>
                <li><Link href="/cookies" className="text-xs text-slate-500 transition hover:text-sky-300">Cookie Policy</Link></li>
                <li><Link href="/refunds" className="text-xs text-slate-500 transition hover:text-sky-300">Refund Policy</Link></li>
                <li><Link href="/acceptable-use" className="text-xs text-slate-500 transition hover:text-sky-300">Acceptable Use</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-white/5 pt-6 text-center text-[11px] text-slate-600">
          &copy; {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
