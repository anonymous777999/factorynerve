import { CloudOff, Lock, Wifi } from "lucide-react";

import { AuthWorkstationShell } from "@/components/auth-workstation-shell";
import { RecoveryBanner } from "@/components/ui/recovery-banner";

export default function OfflinePage() {
  return (
    <AuthWorkstationShell
      sidePanel="minimal"
      badge="Connectivity recovery"
      title="DPR.ai is temporarily offline"
      description="Your entry workflow can keep going on this device while the shell reconnects."
      leftEyebrow="Resilience lane"
      leftTitle="Offline continuity"
      leftDescription="Drafts stay in this browser and queued submissions sync automatically when connectivity returns."
      supportTitle="Local-first entry protection"
      supportDescription="Operators should not lose shift work because the network dropped mid-entry."
      supportItems={[
        {
          icon: <Wifi className="h-4 w-4" />,
          text: "Queued submissions retry automatically once the shell is back online.",
        },
        {
          icon: <CloudOff className="h-4 w-4" />,
          text: "If you already opened DPR Entry, keep working there until sync clears.",
        },
        {
          icon: <Lock className="h-4 w-4" />,
          text: "Draft data remains on this device until a successful sync completes.",
        },
      ]}
      panelClassName="max-w-2xl"
      contentClassName="space-y-5"
    >
      <RecoveryBanner
        kind="offline"
        title="Offline mode active"
        description="Drafts stay in this browser and queued submissions will sync automatically the moment your connection returns."
        meta={
          <>
            Recommended: reopen <span className="font-semibold text-text-primary">DPR Entry</span> once the shell
            reconnects, then press <span className="font-semibold text-text-primary">Sync Now</span> only if the queue
            does not clear automatically.
          </>
        }
      />

      <div className="rounded-panel border border-border-default bg-surface-shell p-4 text-sm leading-6 text-text-secondary">
        <p className="text-label-dense font-medium text-text-tertiary">While you wait</p>
        <p className="mt-2 text-text-primary">
          Keep capturing production data locally. The workstation shell will surface sync status as soon as the network
          path is healthy again.
        </p>
      </div>
    </AuthWorkstationShell>
  );
}
