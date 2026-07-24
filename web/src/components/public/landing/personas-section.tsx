import { personas } from "./data";
import { User, Users, ClipboardPlus, Smartphone } from "lucide-react";

function PersonaIcon({ type }: { type: string }) {
  const cls = "h-6 w-6 text-teal-300";
  if (type === "user") return <User className={cls} strokeWidth={1.8} />;
  if (type === "users") return <Users className={cls} strokeWidth={1.8} />;
  if (type === "clipboard") return <ClipboardPlus className={cls} strokeWidth={1.8} />;
  return <Smartphone className={cls} strokeWidth={1.8} />;
}

export default function PersonasSection() {
  return (
    <section id="roles" className="relative scroll-mt-20 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
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
