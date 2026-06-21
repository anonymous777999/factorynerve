"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import {
  listSteelProductionLines,
  listSteelMachines,
  createSteelMachine,
  type SteelMachine,
  type SteelProductionLine,
} from "@/lib/steel";
import { SteelDowntimeManager } from "@/components/workflow/steel-downtime-manager";
import { SteelMaintenanceManager } from "@/components/workflow/steel-maintenance-manager";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";

function formatNumber(value: number | null | undefined) {
  if (value == null) return "\u2014";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(value);
}

export function SteelMachinesPage() {
  const { user, loading: sessionLoading } = useSession();
  const [machines, setMachines] = useState<SteelMachine[]>([]);
  const [lines, setLines] = useState<SteelProductionLine[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter state
  const [filterLineId, setFilterLineId] = useState<number | null>(null);

  // Manager panel state
  const [downtimeMachineId, setDowntimeMachineId] = useState<number | null>(null);
  const [downtimeMachineName, setDowntimeMachineName] = useState("");
  const [maintenanceMachineId, setMaintenanceMachineId] = useState<number | null>(null);
  const [maintenanceMachineName, setMaintenanceMachineName] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formLineId, setFormLineId] = useState<number | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCapacity, setFormCapacity] = useState("");
  const [formPlannedRuntime, setFormPlannedRuntime] = useState("");
  const [formOperatingRuntime, setFormOperatingRuntime] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    setError("");
    try {
      const [linesRes, machinesRes] = await Promise.all([
        listSteelProductionLines(),
        listSteelMachines(filterLineId),
      ]);
      setLines(linesRes.lines);
      setMachines(machinesRes.machines);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load machines.");
    } finally {
      setPageLoading(false);
    }
  }, [user, filterLineId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!formName.trim()) {
      setSaveError("Machine name is required.");
      return;
    }
    if (!formCode.trim()) {
      setSaveError("Machine code is required.");
      return;
    }
    if (!formLineId) {
      setSaveError("Please select a production line.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await createSteelMachine({
        line_id: formLineId,
        machine_code: formCode.trim(),
        name: formName.trim(),
        machine_type: formType.trim() || null,
        description: formDescription.trim() || null,
        rated_capacity_per_hour: formCapacity ? parseFloat(formCapacity) : null,
        planned_runtime_minutes: formPlannedRuntime ? parseFloat(formPlannedRuntime) : null,
        operating_runtime_minutes: formOperatingRuntime ? parseFloat(formOperatingRuntime) : null,
      });
      setShowForm(false);
      setFormLineId(null);
      setFormCode("");
      setFormName("");
      setFormType("");
      setFormDescription("");
      setFormCapacity("");
      setFormPlannedRuntime("");
      setFormOperatingRuntime("");
      await refresh();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Could not create machine.");
    } finally {
      setSaving(false);
    }
  };

  const getLineName = (lineId: number) => {
    return lines.find((l) => l.id === lineId)?.name ?? `Line #${lineId}`;
  };

  if (sessionLoading || pageLoading) {
    return <DashboardPageSkeleton />;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader><CardTitle>Machines</CardTitle></CardHeader>
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
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-[#e7e5e4] bg-[linear-gradient(135deg,#ffffff,#fafaf9)] p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-prominent text-[#78716c]">Production Setup</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#111111] md:text-4xl">Machines</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#57534e]">
                Manage machine records for utilization tracking, rejection analysis, and batch assignment.
              </p>
            </div>
            <Button variant="outline" onClick={() => { setShowForm(!showForm); setSaveError(""); }}>
              {showForm ? "Cancel" : "Add Machine"}
            </Button>
          </div>

          {showForm ? (
            <div className="mt-6 rounded-2xl border border-[#e7e5e4] bg-white/80 p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Production Line *</label>
                  <Select
                    value={formLineId ? String(formLineId) : ""}
                    onChange={(e) => setFormLineId(parseInt(e.target.value))}
                  >
                    <option value="" disabled>Select line</option>
                    {lines.map((line) => (
                      <option key={line.id} value={String(line.id)}>
                        {line.name} ({line.code})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Machine Code *</label>
                  <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="e.g. RM-01" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Name *</label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Rebar Mill 1" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Type</label>
                  <Input value={formType} onChange={(e) => setFormType(e.target.value)} placeholder="e.g. Rolling Mill, Furnace" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Rated Capacity (kg/hr)</label>
                  <Input type="number" value={formCapacity} onChange={(e) => setFormCapacity(e.target.value)} placeholder="e.g. 5000" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Planned Runtime (min/day)</label>
                  <Input type="number" value={formPlannedRuntime} onChange={(e) => setFormPlannedRuntime(e.target.value)} placeholder="e.g. 480 (8 hours)" />
                  <div className="mt-1 text-[10px] text-[#78716c]">Used for OEE availability calculation</div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[#78716c]">Operating Runtime (min/day)</label>
                  <Input type="number" value={formOperatingRuntime} onChange={(e) => setFormOperatingRuntime(e.target.value)} placeholder="e.g. 420 (7 hours)" />
                  <div className="mt-1 text-[10px] text-[#78716c]">Actual operating time, excluding downtime</div>
                </div>
                <div className="md:col-span-3">
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
                  {saving ? "Saving..." : "Create Machine"}
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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Machine Records</div>
                  <CardTitle className="text-xl text-[#111111]">{machines.length} machine{machines.length !== 1 ? "s" : ""}</CardTitle>
                </div>
                <div className="min-w-[200px]">
                  <Select
                    value={filterLineId ? String(filterLineId) : "all"}
                    onChange={(e) => setFilterLineId(e.target.value === "all" ? null : parseInt(e.target.value))}
                  >
                    <option value="all">All Lines</option>
                    {lines.map((line) => (
                      <option key={line.id} value={String(line.id)}>
                        {line.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <Button variant="outline" onClick={() => void refresh()} disabled={pageLoading}>Refresh</Button>
            </div>
          </CardHeader>
          <CardContent>
            {machines.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                {filterLineId
                  ? "No machines found for the selected line."
                  : "No machines yet. Add a machine to start tracking machine-level utilization and rejection analysis."}
              </div>
            ) : (
              <ResponsiveScrollArea className="rounded-3xl border border-[#e7e5e4]" debugLabel="machines-table">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[#78716c]">
                    <tr className="border-b border-[#e7e5e4]">
                      <th className="px-3 py-3 font-medium">Code</th>
                      <th className="px-3 py-3 font-medium">Name</th>
                      <th className="px-3 py-3 font-medium">Type</th>                          <th className="px-3 py-3 font-medium">Line</th>
                          <th className="px-3 py-3 font-medium">Capacity (kg/hr)</th>
                          <th className="px-3 py-3 font-medium">Status</th>
                          <th className="px-3 py-3 font-medium">Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {machines.map((machine) => (
                      <>
                      <tr key={machine.id} className="border-b border-[#e7e5e4]/60 last:border-none hover:bg-[#f5f5f4]/60">
                        <td className="px-3 py-3 font-mono text-xs font-semibold text-[#111111]">{machine.machine_code}</td>
                        <td className="px-3 py-3 font-semibold text-[#111111]">{machine.name}</td>
                        <td className="px-3 py-3 text-[#57534e]">{machine.machine_type || "\u2014"}</td>
                        <td className="px-3 py-3 text-[#57534e]">{getLineName(machine.line_id)}</td>
                        <td className="px-3 py-3 text-[#57534e]">{formatNumber(machine.rated_capacity_per_hour)}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs uppercase tracking-caption ${
                            machine.is_active
                              ? "bg-emerald-400/12 text-emerald-600 border border-emerald-400/35"
                              : "bg-rose-400/12 text-rose-600 border border-rose-400/35"
                          }`}>
                            {machine.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setDowntimeMachineId(downtimeMachineId === machine.id ? null : machine.id);
                                setDowntimeMachineName(machine.name);
                                setMaintenanceMachineId(null);
                              }}
                            >
                              Events
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setMaintenanceMachineId(maintenanceMachineId === machine.id ? null : machine.id);
                                setMaintenanceMachineName(machine.name);
                                setDowntimeMachineId(null);
                              }}
                            >
                              Maint.
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {downtimeMachineId === machine.id && (
                        <tr key={`dt-${machine.id}`}>
                          <td colSpan={7} className="px-3 py-3">
                            <SteelDowntimeManager machineId={machine.id} machineName={downtimeMachineName} />
                          </td>
                        </tr>
                      )}
                      {maintenanceMachineId === machine.id && (
                        <tr key={`mt-${machine.id}`}>
                          <td colSpan={7} className="px-3 py-3">
                            <SteelMaintenanceManager machineId={machine.id} machineName={maintenanceMachineName} />
                          </td>
                        </tr>
                      )}
                      </>
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
