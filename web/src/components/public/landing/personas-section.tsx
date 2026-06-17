import { personas } from "./data";

function PersonaIcon({ type }: { type: string }) {
  const cls = "h-6 w-6 text-teal-300";
  if (type === "user") return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (type === "users") return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" /><path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (type === "clipboard") return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" strokeLinecap="round" strokeLinejoin="round" /><rect x="8" y="2" width="8" height="4" rx="1" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>;
  return <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>;
}

export default function PersonasSection() {
  return (
    <section id="roles" className="relative scroll-mt-20 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
            Designed for every role on the factory floor
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            From the operator logging production to the owner reviewing risk across plants — each
            persona sees exactly what they need.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {personas.map((p) => (
            <div key={p.role} className="group rounded-2xl border border-white/5 bg-[rgba(23,32,40,0.4)] p-6 backdrop-blur-sm transition hover:border-teal-500/15 hover:bg-[rgba(23,32,40,0.6)]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
                <PersonaIcon type={p.icon} />
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-300">{p.role}</div>
              <h3 className="mt-1 text-lg font-semibold text-white">{p.headline}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{p.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
