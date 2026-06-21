"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import {
  listSteelMachineDowntimeEvents,
  createSteelMachineDowntimeEvent,
  updateSteelMachineDowntimeEvent,
  deleteSteelMachineDowntimeEvent,
  type MachineDowntimeEvent,
} from "@/lib/steel";

const REASON_CATEGORIES = [
  "mechanical_failure",
  "electrical_failure",
  "planned_maintenance",
  "power_outage",
  "material_shortage",
  "operator_error",
  "quality_check",
  "changeover",
  "breakdown",
  "other",
];

const SHIFTS = ["morning", "afternoon", "night"];

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatMinutes(mins: number | null | undefined) {
  if (mins == null) return "—";
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }
  return `${mins}m`;
}

interface Props {
  machineId: number;
  machineName: string;
}

export function SteelDowntimeManager({ machineId, machineName }: Props) {
  const [events, setEvents] = useState<MachineDowntimeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createStartedAt, setCreateStartedAt] = useState("");
  const [createEndedAt, setCreateEndedAt] = useState("");
  const [createDuration, setCreateDuration] = useState("");
  const [createReason, setCreateReason] = useState("");
  const [createReasonDetail, setCreateReasonDetail] = useState("");
  const [createShift, setCreateShift] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Edit state (per event)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStartedAt, setEditStartedAt] = useState("");
  const [editEndedAt, setEditEndedAt] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editReasonDetail, setEditReasonDetail] = useState("");
  const [editShift, setEditShift] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listSteelMachineDowntimeEvents({ machine_id: machineId, limit: 50 });
      setEvents(res.events || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load events.");
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const resetCreate = () => {
    setCreateStartedAt("");
    setCreateEndedAt("");
    setCreateDuration("");
    setCreateReason("");
    setCreateReasonDetail("");
    setCreateShift("");
    setCreateNotes("");
    setSaveError("");
  };

  const handleCreate = async () => {
    if (!createStartedAt) {
      setSaveError("Started at is required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await createSteelMachineDowntimeEvent({
        machine_id: machineId,
        started_at: createStartedAt,
        ended_at: createEndedAt || null,
        duration_minutes: createDuration ? parseFloat(createDuration) : null,
        reason_category: createReason || null,
        reason_detail: createReasonDetail || null,
        shift: createShift || null,
        notes: createNotes || null,
      });
      setShowCreate(false);
      resetCreate();
      await loadEvents();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Could not create event.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (ev: MachineDowntimeEvent) => {
    setEditingId(ev.id);
    setEditStartedAt(ev.started_at);
    setEditEndedAt(ev.ended_at || "");
    setEditDuration(ev.duration_minutes != null ? String(ev.duration_minutes) : "");
    setEditReason(ev.reason_category || "");
    setEditReasonDetail(ev.reason_detail || "");
    setEditShift(ev.shift || "");
    setEditNotes(ev.notes || "");
    setEditError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdate = async (eventId: number) => {
    setEditSaving(true);
    setEditError("");
    try {
      await updateSteelMachineDowntimeEvent(eventId, {
        started_at: editStartedAt,
        ended_at: editEndedAt || null,
        duration_minutes: editDuration ? parseFloat(editDuration) : null,
        reason_category: editReason || null,
        reason_detail: editReasonDetail || null,
        shift: editShift || null,
        notes: editNotes || null,
      });
      setEditingId(null);
      await loadEvents();
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : "Could not update event.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (eventId: number) => {
    setDeletingId(eventId);
    try {
      await deleteSteelMachineDowntimeEvent(eventId);
      setDeletingId(null);
      await loadEvents();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete event.");
      setDeletingId(null);
    }
  };

  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const defaultDateTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Downtime Events — {machineName}</div>
          <div className="text-xs text-[var(--muted)]">{events.length} event{events.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"  onClick={() => void loadEvents()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button  onClick={() => { setShowCreate(!showCreate); resetCreate(); }}>
            {showCreate ? "Cancel" : "Add Event"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>
      ) : null}

      {/* Create Form */}
      {showCreate ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(20,24,36,0.7)] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Started At *</label>
              <Input type="datetime-local" value={createStartedAt} onChange={(e) => setCreateStartedAt(e.target.value)} max={defaultDateTime} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Ended At</label>
              <Input type="datetime-local" value={createEndedAt} onChange={(e) => setCreateEndedAt(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Duration (minutes)</label>
              <Input type="number" value={createDuration} onChange={(e) => setCreateDuration(e.target.value)} placeholder="e.g. 45" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Reason Category</label>
              <Select value={createReason} onChange={(e) => setCreateReason(e.target.value)}>
                <option value="">Select reason</option>
                {REASON_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Shift</label>
              <Select value={createShift} onChange={(e) => setCreateShift(e.target.value)}>
                <option value="">Select shift</option>
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Reason Detail</label>
              <Input value={createReasonDetail} onChange={(e) => setCreateReasonDetail(e.target.value)} placeholder="Optional detail" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Notes</label>
              <Textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="Optional notes" rows={2} />
            </div>
          </div>
          {saveError ? <div className="mt-2 text-sm text-rose-400">{saveError}</div> : null}
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? "Saving..." : "Create Event"}
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      ) : null}

      {/* Events List */}
      {loading ? (
        <div className="py-4 text-center text-sm text-[var(--muted)]">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          No downtime events for this machine yet.
        </div>
      ) : (
        <ResponsiveScrollArea className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]" debugLabel="downtime-events-list">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Ended</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Shift</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-[var(--border)]/60 last:border-none hover:bg-[rgba(62,166,255,0.04)]">
                  {editingId === ev.id ? (
                    <>
                      <td className="px-3 py-2">
                        <Input type="datetime-local" value={editStartedAt} onChange={(e) => setEditStartedAt(e.target.value)} className="text-xs" />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="datetime-local" value={editEndedAt} onChange={(e) => setEditEndedAt(e.target.value)} className="text-xs" />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} className="text-xs w-20" placeholder="mins" />
                      </td>
                      <td className="px-3 py-2">
                        <Select value={editReason} onChange={(e) => setEditReason(e.target.value)} className="text-xs">
                          <option value="">—</option>
                          {REASON_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>
                          ))}
                        </Select>
                        <Input value={editReasonDetail} onChange={(e) => setEditReasonDetail(e.target.value)} placeholder="Detail" className="mt-1 text-xs" />
                      </td>
                      <td className="px-3 py-2">
                        <Select value={editShift} onChange={(e) => setEditShift(e.target.value)} className="text-xs">
                          <option value="">—</option>
                          {SHIFTS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="text-xs" placeholder="Notes" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button  onClick={() => void handleUpdate(ev.id)} disabled={editSaving}>
                            {editSaving ? "..." : "Save"}
                          </Button>
                          <Button  variant="outline" onClick={cancelEdit}>Cancel</Button>
                        </div>
                        {editError ? <div className="mt-1 text-xs text-rose-400">{editError}</div> : null}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-mono text-xs text-white">{formatDateTime(ev.started_at)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--muted)]">{ev.ended_at ? formatDateTime(ev.ended_at) : "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs text-white">{formatMinutes(ev.duration_minutes)}</td>
                      <td className="px-3 py-2">
                        <div className="text-xs text-white capitalize">{ev.reason_category?.replace(/_/g, " ") || "—"}</div>
                        {ev.reason_detail ? <div className="text-[10px] text-[var(--muted)]">{ev.reason_detail}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)] capitalize">{ev.shift || "—"}</td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">{ev.notes || "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button  variant="outline" onClick={() => startEdit(ev)}>Edit</Button>
                          <Button
                            
                            variant="outline"
                            className="border-rose-400/30 text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                            onClick={() => void handleDelete(ev.id)}
                            disabled={deletingId === ev.id}
                          >
                            {deletingId === ev.id ? "..." : "Del"}
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveScrollArea>
      )}
    </div>
  );
}
