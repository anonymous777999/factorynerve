"use client";

import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";

type InvoiceRow = {
  amountLabel: string;
  id: string | number;
  issuedAtLabel: string;
  plan: string;
  provider: string;
  status: string;
};

type BillingInvoiceHistoryProps = {
  emptyLabel: string;
  invoices: InvoiceRow[];
};

export function BillingInvoiceHistory({ emptyLabel, invoices }: BillingInvoiceHistoryProps) {
  return (
    <details className="min-w-0 rounded-3xl border border-[var(--border)] bg-[rgba(20,24,36,0.88)] px-4 py-5 sm:px-5">
      <summary className="cursor-pointer list-none text-lg font-semibold text-[var(--text)]">
        Invoice history
      </summary>
      <div className="mt-4">
        {invoices.length ? (
          <ResponsiveScrollArea debugLabel="billing-invoice-history">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-3 font-medium">ID</th>
                  <th className="px-3 py-3 font-medium">Plan</th>
                  <th className="px-3 py-3 font-medium">Amount</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Issued At</th>
                  <th className="px-3 py-3 font-medium">Provider</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-[var(--border)]/60">
                    <td className="px-3 py-3">{invoice.id}</td>
                    <td className="px-3 py-3">{invoice.plan}</td>
                    <td className="px-3 py-3">{invoice.amountLabel}</td>
                    <td className="px-3 py-3">{invoice.status}</td>
                    <td className="px-3 py-3">{invoice.issuedAtLabel}</td>
                    <td className="px-3 py-3">{invoice.provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveScrollArea>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
            {emptyLabel}
          </div>
        )}
      </div>
    </details>
  );
}
