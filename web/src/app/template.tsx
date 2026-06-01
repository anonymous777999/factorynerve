import * as React from "react";

/**
 * Per-route template. Next.js remounts this wrapper on every navigation, so the
 * fade-in animation replays as routed page content changes. This keeps the
 * transition polish isolated from the persistent AppShell (which is intentionally
 * untouched). Utilities provided by tailwindcss-animate (see tailwind.config.ts).
 */
export default function Template({ children }: { children: React.ReactNode }) {
    return <div className="animate-in fade-in duration-200">{children}</div>;
}
