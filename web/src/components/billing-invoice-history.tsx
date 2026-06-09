"use client";

import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { DisclosurePanel } from "@/shared/operational/disclosure-panel";

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
    <DisclosurePanel title="Invoice history" className="min-w-0">
      <div>
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
    </DisclosurePanel>
  );
}
