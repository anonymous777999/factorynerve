import { ArrowRight } from "lucide-react";

export default function HowItWorksSection() {
  const steps = [
    { num: "01", title: "Capture", desc: "Your team captures production data using mobile cameras, gallery uploads, or direct entry — online or offline. OCR extracts structured rows from paper registers automatically." },
    { num: "02", title: "Review", desc: "Verification queues, approval flows, and bulk review tools clean the data. Every number is checked before it reaches a report. Nothing moves without trust." },
    { num: "03", title: "Act", desc: "Trusted data flows into reports, dashboards, WhatsApp alerts, and intelligence. Owners see risk, managers track dispatch, and the floor keeps running." },
  ];

  return (
    <section id="how-it-works" className="relative scroll-mt-20 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Capture, Review, Act — in one flow
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            Three steps. No switching between apps. No manual Excel merging. No chasing WhatsApp messages to verify a number.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="relative rounded-2xl border border-white/5 bg-[rgba(23,32,40,0.4)] p-6 backdrop-blur-sm">
              {i < 2 && (
                <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-slate-600 sm:block">
                  <ArrowRight className="h-6 w-6" strokeWidth={2} />
                </div>
              )}
              <div className="text-xs font-bold tracking-caption text-amber-400/60">{step.num}</div>
              <h3 className="mt-2 text-xl font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
