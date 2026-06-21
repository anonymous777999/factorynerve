"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import {
  listSteelExpenses,
  createSteelExpense,
  type Expense,
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

const EXPENSE_CATEGORIES = [
  "raw_material",
  "logistics",
  "labour",
  "electricity",
  "maintenance",
  "admin",
  "rent",
  "fuel",
  "other",
];

export function SteelExpensesPage() {
  const { user, loading: sessionLoading } = useSession();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formCategory, setFormCategory] = useState("other");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("0");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formPaymentStatus, setFormPaymentStatus] = useState("unpaid");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    setError("");
    try {
      const res = await listSteelExpenses();
      setExpenses(res.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load expenses.");
    } finally {
      setPageLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!formDescription.trim()) {
      setSaveError("Description is required.");
      return;
    }
    const totalAmount = parseFloat(formAmount) || 0;
    if (totalAmount <= 0) {
      setSaveError("Amount must be greater than 0.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await createSteelExpense({
        expense_date: formDate,
        category: formCategory,
        description: formDescription.trim(),
        amount: totalAmount,
        total_amount: totalAmount,
        payment_status: formPaymentStatus,
      });
      setShowForm(false);
      setFormDescription("");
      setFormAmount("0");
      setFormCategory("other");
      setFormPaymentStatus("unpaid");
      await refresh();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Could not create expense.");
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
          <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
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
              <div className="text-sm uppercase tracking-prominent text-[#78716c]">Expense Management</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#111111] md:text-4xl">Expenses</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#57534e]">
                Track operational expenses and ad-hoc costs outside vendor bill lifecycle.
              </p>
            </div>
            <Button variant="outline" onClick={() => { setShowForm(!showForm); setSaveError(""); }}>
              {showForm ? "Cancel" : "Add Expense"}
            </Button>
          </div>

          {showForm ? (
            <div className="mt-6 rounded-2xl border border-[#e7e5e4] bg-white/80 p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Date</label>
                  <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Category</label>
                  <Select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Amount (INR)</label>
                  <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Description</label>
                  <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="What is this expense for?" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Payment Status</label>
                  <Select value={formPaymentStatus} onChange={(e) => setFormPaymentStatus(e.target.value)}>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </Select>
                </div>
              </div>
              {saveError ? <div className="mt-3 text-sm text-rose-600">{saveError}</div> : null}
              <div className="mt-4 flex gap-2">
                <Button onClick={() => void handleCreate()} disabled={saving}>
                  {saving ? "Saving..." : "Create Expense"}
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
                <div className="text-xs uppercase tracking-wider text-[#78716c]">Expense List</div>
                <CardTitle className="text-xl text-[#111111]">{expenses.length} expenses</CardTitle>
              </div>
              <Button variant="outline" onClick={() => void refresh()} disabled={pageLoading}>Refresh</Button>
            </div>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                No expenses recorded yet.
              </div>
            ) : (
              <ResponsiveScrollArea className="rounded-3xl border border-[#e7e5e4]" debugLabel="expense-table">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[#78716c]">
                    <tr className="border-b border-[#e7e5e4]">
                      <th className="px-3 py-3 font-medium">Date</th>
                      <th className="px-3 py-3 font-medium">Category</th>
                      <th className="px-3 py-3 font-medium">Description</th>
                      <th className="px-3 py-3 font-medium">Amount</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-b border-[#e7e5e4]/60 last:border-none hover:bg-[#f5f5f4]/60">
                        <td className="px-3 py-3 text-[#57534e]">{e.expense_date}</td>
                        <td className="px-3 py-3 text-[#57534e]">{e.category.replace(/_/g, " ")}</td>
                        <td className="px-3 py-3 font-semibold text-[#111111]">{e.description}</td>
                        <td className="px-3 py-3 font-semibold text-[#111111]">{formatCurrency(e.total_amount)}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs uppercase tracking-caption ${
                            e.payment_status === "paid"
                              ? "bg-emerald-400/12 text-emerald-600 border border-emerald-400/35"
                              : "bg-amber-400/12 text-amber-600 border border-amber-400/35"
                          }`}>
                            {e.payment_status}
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
