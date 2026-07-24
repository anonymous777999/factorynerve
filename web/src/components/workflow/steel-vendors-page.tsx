"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import {
  listSteelVendors,
  createSteelVendor,
  type Vendor,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function SteelVendorsPage() {
  const { user, loading: sessionLoading } = useSession();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formTerms, setFormTerms] = useState("0");
  const [formCredit, setFormCredit] = useState("0");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    setError("");
    try {
      const res = await listSteelVendors();
      setVendors(res.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load vendors.");
    } finally {
      setPageLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!formName.trim()) {
      setSaveError("Vendor name is required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await createSteelVendor({
        name: formName.trim(),
        vendor_code: formCode.trim() || null,
        phone: formPhone.trim() || null,
        city: formCity.trim() || null,
        state: formState.trim() || null,
        payment_terms_days: parseInt(formTerms) || 0,
        credit_limit: parseFloat(formCredit) || 0,
      });
      setShowForm(false);
      setFormName("");
      setFormCode("");
      setFormPhone("");
      setFormCity("");
      setFormState("");
      setFormTerms("0");
      setFormCredit("0");
      await refresh();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Could not create vendor.");
    } finally {
      setSaving(false);
    }
  };

  if (sessionLoading || pageLoading) {
    return <DashboardPageSkeleton />;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader><CardTitle>Vendors</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm text-red-400">Please sign in to continue.</div>
            <Link href="/access"><Button>Open Access</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_48%,#fafaf9_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[2rem] border border-[#e7e5e4] bg-[linear-gradient(135deg,#ffffff,#fafaf9)] p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-prominent text-[#78716c]">Vendor Management</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#111111] md:text-4xl">Vendors</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#57534e]">
                Manage vendor master records for accounts payable tracking and bill management.
              </p>
            </div>
            <Button variant="outline" onClick={() => { setShowForm(!showForm); setSaveError(""); }}>
              {showForm ? "Cancel" : "Add Vendor"}
            </Button>
          </div>

          {showForm ? (
            <div className="mt-6 rounded-2xl border border-[#e7e5e4] bg-white/80 p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Name *</label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Vendor name" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Code</label>
                  <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="Optional code" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Phone</label>
                  <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Phone number" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">City</label>
                  <Input value={formCity} onChange={(e) => setFormCity(e.target.value)} placeholder="City" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">State</label>
                  <Input value={formState} onChange={(e) => setFormState(e.target.value)} placeholder="State" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Payment Terms (days)</label>
                  <Input type="number" value={formTerms} onChange={(e) => setFormTerms(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Credit Limit (INR)</label>
                  <Input type="number" value={formCredit} onChange={(e) => setFormCredit(e.target.value)} />
                </div>
              </div>
              {saveError ? <div className="mt-3 text-sm text-rose-600">{saveError}</div> : null}
              <div className="mt-4 flex gap-2">
                <Button onClick={() => void handleCreate()} disabled={saving}>
                  {saving ? "Saving..." : "Create Vendor"}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</div>
        ) : null}

        <Card className="border border-[#e7e5e4] bg-white shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-[#78716c]">Vendor List</div>
                <CardTitle className="text-xl text-[#111111]">{vendors.length} vendors</CardTitle>
              </div>
              <Button variant="outline" onClick={() => void refresh()} disabled={pageLoading}>Refresh</Button>
            </div>
          </CardHeader>
          <CardContent>
            {vendors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                No vendors yet. Add a vendor to start tracking bills and payables.
              </div>
            ) : (
              <ResponsiveScrollArea className="rounded-3xl border border-[#e7e5e4]" debugLabel="vendor-table">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[#78716c]">
                    <tr className="border-b border-[#e7e5e4]">
                      <th className="px-3 py-3 font-medium">Name</th>
                      <th className="px-3 py-3 font-medium">Code</th>
                      <th className="px-3 py-3 font-medium">City</th>
                      <th className="px-3 py-3 font-medium">Payment Terms</th>
                      <th className="px-3 py-3 font-medium">Credit Limit</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v) => (
                      <tr key={v.id} className="border-b border-[#e7e5e4]/60 last:border-none hover:bg-[#f5f5f4]/60">
                        <td className="px-3 py-3 font-semibold text-[#111111]">{v.name}</td>
                        <td className="px-3 py-3 text-[#57534e]">{v.vendor_code || "\u2014"}</td>
                        <td className="px-3 py-3 text-[#57534e]">{v.city || "\u2014"}</td>
                        <td className="px-3 py-3 text-[#57534e]">{v.payment_terms_days} days</td>
                        <td className="px-3 py-3 text-[#57534e]">{formatCurrency(v.credit_limit)}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs uppercase tracking-caption ${
                            v.is_active ? "bg-emerald-400/12 text-emerald-600 border border-emerald-400/35" : "bg-rose-400/12 text-rose-600 border border-rose-400/35"
                          }`}>
                            {v.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
