"use client";

import { DisclosurePanel } from "@/shared/operational/disclosure-panel";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type PlanOption = {
  id: string;
  name: string;
};

type BillingOwnerControlsProps = {
  busy: boolean;
  canWriteBilling: boolean;
  downgradePlan: string;
  manualOverrideEnabled: boolean;
  overridePlan: string;
  pendingDowngradeDetail: string | null;
  planOptions: PlanOption[];
  readOnlyMessage: string;
  onCancelDowngrade: () => void;
  onDowngradePlanChange: (value: string) => void;
  onOverridePlanChange: (value: string) => void;
  onScheduleDowngrade: () => void;
  onUpdatePlan: () => void;
};

export function BillingOwnerControls({
  busy,
  canWriteBilling,
  downgradePlan,
  manualOverrideEnabled,
  overridePlan,
  pendingDowngradeDetail,
  planOptions,
  readOnlyMessage,
  onCancelDowngrade,
  onDowngradePlanChange,
  onOverridePlanChange,
  onScheduleDowngrade,
  onUpdatePlan,
}: BillingOwnerControlsProps) {
  return (
    <DisclosurePanel title="Plan controls" className="min-w-0">
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="text-sm font-semibold">Scheduled downgrade</div>
          {pendingDowngradeDetail ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                {pendingDowngradeDetail}
              </div>
              <Button variant="outline" onClick={onCancelDowngrade} disabled={busy || !canWriteBilling}>
                Cancel downgrade
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Select aria-label="Select plan to schedule downgrade" value={downgradePlan} onChange={(event) => onDowngradePlanChange(event.target.value)}>
                {planOptions.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </Select>
              <Button variant="outline" onClick={onScheduleDowngrade} disabled={busy || !canWriteBilling}>
                Schedule downgrade
              </Button>
            </div>
          )}
        </div>

        {manualOverrideEnabled ? (
          <div className="space-y-3">
            <div className="text-sm font-semibold">Manual org plan override</div>
            <div className="text-sm text-[var(--muted)]">
              This emergency control is enabled by environment flag. Keep it off for normal billing so Razorpay stays the
              only upgrade path.
            </div>
            <Select aria-label="Select plan for manual org override" value={overridePlan} onChange={(event) => onOverridePlanChange(event.target.value)}>
              {planOptions.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </Select>
            <Button onClick={onUpdatePlan} disabled={busy || !canWriteBilling}>
              Update plan
            </Button>
          </div>
        ) : null}

        {!canWriteBilling ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
            {readOnlyMessage}
          </div>
        ) : null}
      </div>
    </DisclosurePanel>
  );
}
