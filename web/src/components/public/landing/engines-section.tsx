import { engines } from "./data";

function EngineIcon({ id }: { id: string }) {
  const cls = "h-6 w-6 text-amber-300";
  if (id === "capture") return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="13" r="4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (id === "execution") return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>;
  if (id === "trust") return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l7 3v7c0 4.5-3.5 8-7 9-3.5-1-7-4.5-7-9V5l7-3z" strokeLinecap="round" strokeLinejoin="round" /><polyline points="9 12 11 14 15 10" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (id === "reporting") return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>;
  if (id === "intelligence") return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 3l-5 5" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 3h6v6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (id === "steel") return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>;
  return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function EnginesSection() {
  return (
    <section id="engines" className="relative scroll-mt-20 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
            Seven engines. One operating system.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            DPR.ai is not a single tool. It is a complete operational infrastructure — from
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
