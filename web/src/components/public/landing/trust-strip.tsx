"use client";

import { useEffect, useRef, useState } from "react";
import { stats } from "./data";

function AnimatedCounter({ value, suffix }: { value: string; suffix?: string }) {
  const [displayed, setDisplayed] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const num = parseInt(value.replace(/,/g, ""));
    if (isNaN(num)) { setDisplayed(value); return; }
    let start = 0;
    const duration = 1500;
    const step = Math.ceil(num / 60);
    const interval = setInterval(() => {
      start += step;
      if (start >= num) { setDisplayed(value); clearInterval(interval); }
      else setDisplayed(start.toLocaleString("en-IN"));
    }, duration / 60);
    return () => clearInterval(interval);
  }, [visible, value]);

  return (
    <span ref={ref}>
      {displayed || value}{suffix || ""}
    </span>
  );
}

export default function TrustStrip() {
  return (
    <section className="relative px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
              <div className="text-2xl font-bold tracking-[-0.02em] text-amber-300 sm:text-3xl">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="mt-2 text-xs text-slate-400 sm:text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
