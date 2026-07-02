import Link from "next/link";

interface ComingSoonPageProps {
  title?: string;
}

export default function ComingSoonPage({ title = "Coming Soon" }: ComingSoonPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090d14] px-4">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(197,109,45,0.24),rgba(197,109,45,0.10))] text-2xl font-bold text-amber-300">
          F
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-400">
          We&rsquo;re working on this page and it will be available soon. Check back later.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-[linear-gradient(135deg,rgba(197,109,45,0.9),rgba(197,109,45,0.6))] px-6 py-3 text-sm font-semibold text-[#06111c] shadow-[0_8px_20px_rgba(197,109,45,0.25)] transition hover:brightness-110"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
