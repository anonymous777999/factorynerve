"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHomeDestination } from "@/lib/role-navigation";
import { useSession } from "@/lib/use-session";

function destinationLabel(href: string) {
  switch (href) {
    case "/attendance":
      return "your attendance desk";
    case "/dashboard":
      return "your operations board";
    case "/approvals":
      return "your review queue";
    case "/reports":
      return "your reports desk";
    case "/settings":
      return "your admin desk";
    case "/control-tower":
      return "your factory network";
    case "/premium/dashboard":
      return "your owner desk";
    default:
      return "your workspace";
  }
}

export default function HomeRoute() {
  const router = useRouter();
  const { user, organization, loading, error } = useSession();

  const destination = useMemo(
    () => getHomeDestination(user?.role, organization?.accessible_factories || 0),
    [organization?.accessible_factories, user?.role],
  );

  useEffect(() => {
    if (!loading && user) {
      router.replace(destination);
    }
  }, [destination, loading, router, user]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <Card className="w-full max-w-lg border border-[var(--border)] bg-[var(--card)] shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Loading workspace</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted)]">
            Checking your session and opening the right desk for your role.
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <Card className="w-full max-w-3xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
          <CardHeader>
            <div className="text-sm uppercase tracking-[0.24em] text-[var(--accent)]">DPR.ai</div>
            <CardTitle className="text-3xl">Factory control without the noise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AUDIT: TEXT_NOISE - keep the home entry message compact so the sign-in action stays primary */}
            <p className="max-w-2xl text-sm text-[var(--muted)]">Open your workspace.</p>
            {error ? <div className="text-sm text-red-400">{error}</div> : null}
            <div className="flex flex-wrap gap-3">
              {/* AUDIT: FLOW_BROKEN - route the primary entry action to the live auth entry instead of the stale login route */}
              <Link href="/access">
                <Button>Open workspace</Button>
              </Link>
              <Link href="/register">
                <Button variant="outline">Create account</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-lg border border-[var(--border)] bg-[var(--card)] shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Opening {destinationLabel(destination)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AUDIT: TEXT_NOISE - trim the redirect message so the fallback action reads faster */}
          <p className="text-sm text-[var(--muted)]">Your role-based home is ready. Use the button below if the redirect pauses.</p>
          <Link href={destination}>
            <Button>Continue</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
