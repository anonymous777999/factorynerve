"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/use-session";

export default function FactoryRequiredPage() {
  const { user } = useSession();

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-app px-6 py-10 text-text-primary">
      <div className="w-full max-w-xl rounded-panel border border-border-default bg-surface-card p-8 shadow-md">
        <div className="text-label-dense font-semibold text-text-tertiary">
          Workspace access
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-text-primary">
          Factory access is not available
        </h1>
        <p className="mt-4 text-sm leading-7 text-text-secondary">
          Your active factory access was removed or has not been set up yet. Contact your
          administrator to restore access, or sign in to a different account.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/access">
            <Button variant="outline">Back to sign in</Button>
          </Link>
          {user ? (
            <Link href="/settings">
              <Button>Open factory settings</Button>
            </Link>
          ) : null}
        </div>

        <p className="mt-6 text-sm text-text-tertiary">
          If this is a mistake, ask your factory admin to check your user access in{" "}
          <strong className="text-text-secondary">Settings → Users</strong>.
        </p>
      </div>
    </main>
  );
}
