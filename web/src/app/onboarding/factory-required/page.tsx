"use client";

import Link from "next/link";
import { AlertTriangle, Building2, Lock, Mail } from "lucide-react";

import { AuthWorkstationShell } from "@/components/auth-workstation-shell";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/use-session";

export default function FactoryRequiredPage() {
  const { user } = useSession();

  return (
    <AuthWorkstationShell
      sidePanel="minimal"
      badge="Workspace access"
      title="Factory access is not available"
      description="Your active factory access was removed or has not been set up yet. Contact your administrator to restore access, or sign in to a different account."
      leftEyebrow="Access gate"
      leftTitle="Factory assignment required"
      leftDescription="Operational workspaces stay locked until an administrator binds this account to an active factory profile."
      supportTitle="Restore access safely"
      supportDescription="User governance in Settings controls which factories each operator can reach."
      supportItems={[
        {
          icon: <Building2 className="h-4 w-4" />,
          text: "Ask your factory admin to confirm the account is assigned to the correct plant.",
        },
        {
          icon: <Lock className="h-4 w-4" />,
          text: "Removed access revokes workstation routes until provisioning is restored.",
        },
        {
          icon: <Mail className="h-4 w-4" />,
          text: "Use a different verified inbox if you belong to another operating organization.",
        },
      ]}
      panelClassName="max-w-xl"
      contentClassName="space-y-6"
    >
      <div className="rounded-panel border border-status-warning-border bg-status-warning-bg p-4 text-sm text-status-warning-fg">
        <div className="flex gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <p>
            If this is a mistake, ask your factory admin to check user access in{" "}
            <strong className="font-medium">Settings → Users</strong>.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/access">
          <Button variant="outline">Back to sign in</Button>
        </Link>
        {user ? (
          <Link href="/settings">
            <Button className="factory-auth-cta border-transparent">Open factory settings</Button>
          </Link>
        ) : null}
      </div>
    </AuthWorkstationShell>
  );
}
