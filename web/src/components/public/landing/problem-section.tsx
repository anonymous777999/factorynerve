import { painPoints } from "./data";

function PainIcon({ type }: { type: string }) {
  const cls = "h-6 w-6 text-amber-400/80";
  if (type === "file") return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" /><line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round" /><line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round" /></svg>;
  if (type === "message") return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function ProblemSection() {
  return (
    <section id="problem" className="relative scroll-mt-20 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Every factory runs on data. Most of it never makes it to a decision.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            Paper registers, WhatsApp groups, and spreadsheets were never designed to run a
            modern factory. The cracks between them cost time, money, and trust.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {painPoints.map((p) => (
            <div key={p.title} className="group rounded-2xl border border-white/5 bg-[rgba(23,32,40,0.4)] p-6 backdrop-blur-sm transition hover:border-amber-500/15 hover:bg-[rgba(23,32,40,0.6)]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <PainIcon type={p.icon} />
              </div>
              <h3 className="text-lg font-semibold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
