/**
 * DEBUGGING COMPONENT FOR DISPATCH WORKFLOW
 * 
 * Add this import to steel-dispatches-page.tsx:
 * import { DispatchDebugPanel } from "@/components/steel-dispatches-debug";
 * 
 * Then add this component right after the main header section:
 * <DispatchDebugPanel 
 *   invoices={invoices}
 *   selectedInvoiceId={selectedInvoiceId}
 *   selectedInvoice={selectedInvoice}
 *   lineDrafts={lineDrafts}
 *   error={error}
 * />
 */

import type { SteelInvoice, SteelInvoiceDetail } from "@/lib/steel";

type DispatchDraftLine = {
    invoice_line_id: number;
    weight_kg: string;
};

export function DispatchDebugPanel({
    invoices,
    selectedInvoiceId,
    selectedInvoice,
    lineDrafts,
    error,
}: {
    invoices: SteelInvoice[];
    selectedInvoiceId: string;
    selectedInvoice: SteelInvoiceDetail | null;
    lineDrafts: DispatchDraftLine[];
    error: string;
}) {
    return (
        <div className="rounded-2xl border-2 border-orange-500 bg-orange-950/50 p-4 text-xs">
            <div className="font-bold text-orange-300">🐛 DEBUG PANEL (Remove in production)</div>

            <div className="mt-3 space-y-2">
                <div>
                    <span className="text-orange-400">Invoices loaded:</span>{" "}
                    <span className="font-mono text-white">{invoices.length}</span>
                </div>

                {invoices.length > 0 ? (
                    <details className="text-orange-300">
                        <summary className="cursor-pointer">View invoice IDs</summary>
                        <div className="mt-2 font-mono text-white">
                            {invoices.map((inv) => (
                                <div key={inv.id}>
                                    ID: {inv.id} | Number: {inv.invoice_number} | Customer: {inv.customer_name}
                                </div>
                            ))}
                        </div>
                    </details>
                ) : (
                    <div className="text-orange-400">⚠️ NO INVOICES FOUND - Create invoices first!</div>
                )}

                <div>
                    <span className="text-orange-400">Selected invoice ID (state):</span>{" "}
                    <span className="font-mono text-white">
                        {selectedInvoiceId || "EMPTY"} (type: {typeof selectedInvoiceId})
                    </span>
                </div>

                <div>
                    <span className="text-orange-400">Selected invoice (loaded):</span>{" "}
                    <span className="font-mono text-white">
                        {selectedInvoice ? `✅ Loaded (${selectedInvoice.invoice.invoice_number})` : "❌ NULL"}
                    </span>
                </div>

                {selectedInvoice ? (
                    <details className="text-orange-300">
                        <summary className="cursor-pointer">View invoice detail</summary>
                        <div className="mt-2 space-y-1 font-mono text-white">
                            <div>Invoice lines: {selectedInvoice.invoice.lines?.length || 0}</div>
                            {(selectedInvoice.invoice.lines || []).map((line) => (
                                <div key={line.id} className="ml-4 text-xs">
                                    Line {line.id}: {line.item_code} | Ordered: {line.weight_kg} KG |
                                    Dispatched: {line.dispatched_weight_kg} KG |
                                    Remaining: {line.remaining_weight_kg} KG
                                </div>
                            ))}
                        </div>
                    </details>
                ) : null}

                <div>
                    <span className="text-orange-400">Line drafts initialized:</span>{" "}
                    <span className="font-mono text-white">
                        {lineDrafts.length} lines
                    </span>
                </div>

                {lineDrafts.length > 0 ? (
                    <details className="text-orange-300">
                        <summary className="cursor-pointer">View line drafts</summary>
                        <div className="mt-2 font-mono text-white">
                            {lineDrafts.map((draft) => (
                                <div key={draft.invoice_line_id}>
                                    Line {draft.invoice_line_id}: weight_kg = &quot;{draft.weight_kg}&quot;
                                </div>
                            ))}
                        </div>
                    </details>
                ) : null}

                {error ? (
                    <div className="rounded border border-red-500 bg-red-950/50 p-2 text-red-300">
                        <div className="font-bold">ERROR:</div>
                        <div className="font-mono">{error}</div>
                    </div>
                ) : null}

                <div className="mt-3 space-y-1 border-t border-orange-500 pt-2 text-orange-300">
                    <div className="font-bold">Diagnostic checks:</div>
                    <div>✓ Dropdown renders: Check if &lt;select&gt; has options</div>
                    <div>✓ Value updates: selectedInvoiceId should match selected option</div>
                    <div>✓ API call: Network tab should show GET /steel/invoices/[id]</div>
                    <div>✓ Lines exist: Invoice should have lines with remaining_weight_kg &gt; 0</div>
                </div>
            </div>
        </div>
    );
}
