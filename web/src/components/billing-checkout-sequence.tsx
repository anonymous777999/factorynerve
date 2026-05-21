"use client";

type BillingCheckoutSequenceProps = {
  steps: Array<{
    detail: string;
    label: string;
  }>;
};

export function BillingCheckoutSequence({ steps }: BillingCheckoutSequenceProps) {
  return (
    <section className="grid gap-3 xl:grid-cols-3">
      {steps.map((step) => (
        <div
          key={step.label}
          className="rounded-3xl border border-[var(--border)] bg-[var(--card-strong)] px-5 py-4"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            {step.label}
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">{step.detail}</div>
        </div>
      ))}
    </section>
  );
}
