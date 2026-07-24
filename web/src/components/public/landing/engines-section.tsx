import { engines } from "./data";
import { Camera, LayoutDashboard, ShieldCheck, FileText, LayoutGrid, Settings } from "lucide-react";

function EngineIcon({ id }: { id: string }) {
  const cls = "h-6 w-6 text-amber-300";
  if (id === "capture") return <Camera className={cls} strokeWidth={1.8} />;
  if (id === "execution") return <LayoutDashboard className={cls} strokeWidth={1.8} />;
  if (id === "trust") return <ShieldCheck className={cls} strokeWidth={1.8} />;
  if (id === "reporting") return <FileText className={cls} strokeWidth={1.8} />;
  // "intelligence" keeps its bespoke arc+external-arrow glyph — no exact lucide equivalent
  // (Radar/Sparkles/TrendingUp would all shift the meaning). Documented Phase-2.5 exception.
  if (id === "intelligence") return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 3l-5 5" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 3h6v6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (id === "steel") return <LayoutGrid className={cls} strokeWidth={1.8} />;
  return <Settings className={cls} strokeWidth={1.8} />;
}

export default function EnginesSection() {
  return (
    <section id="engines" className="relative scroll-mt-20 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Seven engines. One operating system.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            Factory Nerve is not a single tool. It is a complete operational infrastructure — from
            capture to intelligence — designed for the way factories actually work.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {engines.slice(0, 3).map((e) => (
            <EngineCard key={e.id} engine={e} />
          ))}
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {engines.slice(3).map((e) => (
                <EngineCard key={e.id} engine={e} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EngineCard({ engine }: { engine: typeof engines[0] }) {
  return (
    <div className="group rounded-2xl border border-white/5 bg-[rgba(23,32,40,0.4)] p-5 backdrop-blur-sm transition hover:border-amber-500/12 hover:bg-[rgba(23,32,40,0.6)]">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
        <EngineIcon id={engine.id} />
      </div>
      <h3 className="text-sm font-semibold text-amber-200/90">{engine.title}</h3>
      <p className="mt-0.5 text-xs font-medium text-slate-300">{engine.tagline}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{engine.description}</p>
    </div>
  );
}
