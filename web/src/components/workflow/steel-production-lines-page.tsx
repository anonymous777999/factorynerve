"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import {
  listSteelProductionLines,
  createSteelProductionLine,
  type SteelProductionLine,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";

export function SteelProductionLinesPage() {
  const { user, loading: sessionLoading } = useSession();
  const [lines, setLines] = useState<SteelProductionLine[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    setError("");
    try {
      const res = await listSteelProductionLines();
      setLines(res.lines);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load production lines.");
    } finally {
      setPageLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!formName.trim()) {
      setSaveError("Line name is required.");
      return;
    }
    if (!formCode.trim()) {
      setSaveError("Line code is required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await createSteelProductionLine({
        name: formName.trim(),
        code: formCode.trim(),
        description: formDescription.trim() || null,
      });
      setShowForm(false);
      setFormName("");
      setFormCode("");
      setFormDescription("");
      await refresh();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Could not create production line.");
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
          <CardHeader><CardTitle>Production Lines</CardTitle></CardHeader>
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
              <div className="text-sm uppercase tracking-prominent text-[#78716c]">Production Setup</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#111111] md:text-4xl">Production Lines</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#57534e]">
                Manage production line records for line-level efficiency tracking and batch assignment.
              </p>
            </div>
            <Button variant="outline" onClick={() => { setShowForm(!showForm); setSaveError(""); }}>
              {showForm ? "Cancel" : "Add Line"}
            </Button>
          </div>

          {showForm ? (
            <div className="mt-6 rounded-2xl border border-[#e7e5e4] bg-white/80 p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Name *</label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. TMT Bar Line 1" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Code *</label>
                  <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="e.g. TMT-L1" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Description</label>
                  <Textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description"
                    rows={2}
                  />
                </div>
              </div>
              {saveError ? <div className="mt-3 text-sm text-rose-600">{saveError}</div> : null}
              <div className="mt-4 flex gap-2">
                <Button onClick={() => void handleCreate()} disabled={saving}>
                  {saving ? "Saving..." : "Create Line"}
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
                <div className="text-xs uppercase tracking-wider text-[#78716c]">Line Records</div>
                <CardTitle className="text-xl text-[#111111]">{lines.length} line{lines.length !== 1 ? "s" : ""}</CardTitle>
              </div>
              <Button variant="outline" onClick={() => void refresh()} disabled={pageLoading}>Refresh</Button>
            </div>
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                No production lines yet. Add a line to start tracking line-level efficiency in batch production.
              </div>
            ) : (
              <ResponsiveScrollArea className="rounded-3xl border border-[#e7e5e4]" debugLabel="production-lines-table">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[#78716c]">
                    <tr className="border-b border-[#e7e5e4]">
                      <th className="px-3 py-3 font-medium">Name</th>
                      <th className="px-3 py-3 font-medium">Code</th>
                      <th className="px-3 py-3 font-medium">Description</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-b border-[#e7e5e4]/60 last:border-none hover:bg-[#f5f5f4]/60">
                        <td className="px-3 py-3 font-semibold text-[#111111]">{line.name}</td>
                        <td className="px-3 py-3 text-[#57534e]">{line.code || "\u2014"}</td>
                        <td className="px-3 py-3 text-[#57534e]">{line.description || "\u2014"}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs uppercase tracking-caption ${
                            line.is_active
                              ? "bg-emerald-400/12 text-emerald-600 border border-emerald-400/35"
                              : "bg-rose-400/12 text-rose-600 border border-rose-400/35"
                          }`}>
                            {line.is_active ? "Active" : "Inactive"}
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
