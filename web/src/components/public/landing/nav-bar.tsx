"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { navItems, sectionIds } from "./data";

function DprLogo() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(197,109,45,0.24),rgba(197,109,45,0.10))] text-sm font-bold text-amber-300">
      D
    </div>
  );
}

export default function NavBar() {
  const [activeId, setActiveId] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    for (const item of navItems) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/5 bg-[#0d1218]/90 shadow-[0_4px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <DprLogo />
          <span className="text-sm font-semibold tracking-tight text-white">DPR.ai</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`rounded-lg px-3 py-2 text-xs font-medium tracking-wide transition ${
                activeId === item.id
                  ? "text-amber-300"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.label}
            </a>
          ))}
          <div className="ml-4">
            <Link
              href="/access"
              className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-[linear-gradient(135deg,rgba(197,109,45,0.9),rgba(197,109,45,0.6))] px-5 py-2 text-xs font-semibold text-[#06111c] shadow-[0_8px_20px_rgba(197,109,45,0.25)] transition hover:brightness-110 hover:shadow-[0_12px_28px_rgba(197,109,45,0.35)]"
            >
              Get started
            </Link>
          </div>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 md:hidden"
          aria-label="Toggle menu"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/5 bg-[#0d1218]/95 px-4 pb-4 backdrop-blur-xl md:hidden">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-3 text-sm text-slate-300 hover:text-white"
            >
              {item.label}
            </a>
          ))}
          <Link
            href="/access"
            onClick={() => setMobileOpen(false)}
            className="mt-2 flex items-center justify-center rounded-full border border-amber-500/20 bg-[linear-gradient(135deg,rgba(197,109,45,0.9),rgba(197,109,45,0.6))] px-5 py-3 text-sm font-semibold text-[#06111c]"
          >
            Get started
          </Link>
        </div>
      )}
    </nav>
  );
}
