"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, ShieldAlert, ShieldCheck } from "lucide-react";

import { AuthWorkstationShell } from "@/components/auth-workstation-shell";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/use-session";

export default function AccessRestrictedPage() {
  const router = useRouter();
  const { user } = useSession();

  return (
    <AuthWorkstationShell
      sidePanel="minimal"
      badge="Access restricted"
      title="You don't have permission to access this page."
      description="Your workspace is active, but this destination is reserved for a different permission level."
      leftEyebrow="Authorization lane"
      leftTitle="Role boundary enforced"
      leftDescription="Factory OS keeps sensitive routes behind explicit role checks so operators only reach desks they are provisioned for."
      supportTitle="Permission mismatch"
      supportDescription="Contact your administrator if your role should include this destination."
      supportItems={[
        {
          icon: <ShieldCheck className="h-4 w-4" />,
          text: "Your session stays valid; only this route is blocked.",
        },
        {
          icon: <Lock className="h-4 w-4" />,
          text: "Role routing prevents cross-factory or cross-desk access leaks.",
        },
        {
          icon: <ShieldAlert className="h-4 w-4" />,
          text: "Administrators can adjust role assignments in user governance.",
        },
      ]}
      metrics={[{ label: "Your role", value: user?.role || "unknown" }]}
      panelClassName="max-w-xl"
      contentClassName="space-y-6"
    >
      <div className="rounded-panel border border-status-warning-border bg-status-warning-bg p-4 text-sm text-status-warning-fg">
        <div className="flex gap-3">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          <p>
            Return to your assigned dashboard or contact an administrator to request elevated access for this
            workstation route.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => router.push("/dashboard")} className="factory-auth-cta border-transparent">
          Back to Dashboard
        </Button>
        <Link href="mailto:admin@dpr.ai">
          <Button variant="outline" className="inline-flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Contact administrator
          </Button>
        </Link>
      </div>
    </AuthWorkstationShell>
  );
}
