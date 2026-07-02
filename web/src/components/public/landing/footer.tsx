import Link from "next/link";
import { FnLogo } from "@/components/shared/fn-logo";
import { COMPANY_NAME } from "./data";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <FnLogo variant="mark" className="h-8 w-8" />
              <span className="text-sm font-semibold text-white">Factory Nerve</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">{COMPANY_NAME}<br />Shillong, Meghalaya, India</p>
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
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Company</div>
              <ul className="mt-3 space-y-2">
                <li><Link href="/contact" className="text-xs text-slate-500 transition hover:text-sky-300">Support</Link></li>
                <li><span className="text-xs text-slate-600">Pilot program — now open</span></li>
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Legal</div>
              <ul className="mt-3 space-y-2">
                <li><span className="text-xs text-slate-600">Privacy &amp; Terms — coming soon</span></li>
                <li><a href="mailto:support@factorynerve.online" className="text-xs text-slate-500 transition hover:text-sky-300">support@factorynerve.online</a></li>
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
