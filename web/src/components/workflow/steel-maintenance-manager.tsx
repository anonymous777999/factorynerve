"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import {
  listSteelMaintenanceTasks,
  createSteelMaintenanceTask,
  updateSteelMaintenanceTask,
  deleteSteelMaintenanceTask,
  updateSteelMaintenanceTaskStatus,
  type SteelMaintenanceTask,
} from "@/lib/steel";

const MAINTENANCE_TYPES = ["preventive", "corrective", "predictive", "emergency", "routine"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["scheduled", "in_progress", "completed", "cancelled"];

const PRIORITY_COLORS: Record<string, string> = {
  low: "border-emerald-400/25 bg-emerald-400/8 text-emerald-200/80",
  medium: "border-amber-400/25 bg-amber-400/8 text-amber-200/80",
  high: "border-orange-400/35 bg-orange-400/12 text-orange-200",
  critical: "border-rose-400/35 bg-rose-400/12 text-rose-200",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "border-sky-400/25 bg-sky-400/8 text-sky-200/80",
  in_progress: "border-amber-400/35 bg-amber-400/12 text-amber-200",
  completed: "border-emerald-400/35 bg-emerald-400/12 text-emerald-200",
  cancelled: "border-[var(--border)] bg-[rgba(20,24,36,0.5)] text-[var(--muted)]",
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

interface Props {
  machineId: number;
  machineName: string;
}

export function SteelMaintenanceManager({ machineId, machineName }: Props) {
  const [tasks, setTasks] = useState<SteelMaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createType, setCreateType] = useState("preventive");
  const [createPriority, setCreatePriority] = useState("medium");
  const [createScheduledDate, setCreateScheduledDate] = useState("");
  const [createAssignedTo, setCreateAssignedTo] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editScheduledDate, setEditScheduledDate] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Status update
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listSteelMaintenanceTasks({ machine_id: machineId, limit: 50 });
      setTasks(res.tasks || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const resetCreate = () => {
    setCreateTitle("");
    setCreateDescription("");
    setCreateType("preventive");
    setCreatePriority("medium");
    setCreateScheduledDate("");
    setCreateAssignedTo("");
    setCreateNotes("");
    setSaveError("");
  };

  const handleCreate = async () => {
    if (!createTitle.trim()) {
      setSaveError("Title is required.");
      return;
    }
    if (!createScheduledDate) {
      setSaveError("Scheduled date is required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await createSteelMaintenanceTask({
        machine_id: machineId,
        title: createTitle.trim(),
        description: createDescription.trim() || null,
        maintenance_type: createType,
        priority: createPriority,
        scheduled_date: createScheduledDate,
        assigned_to_user_id: createAssignedTo ? parseInt(createAssignedTo) : null,
        notes: createNotes.trim() || null,
      });
      setShowCreate(false);
      resetCreate();
      await loadTasks();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Could not create task.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (task: SteelMaintenanceTask) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditType(task.maintenance_type);
    setEditPriority(task.priority);
    setEditScheduledDate(task.scheduled_date);
    setEditAssignedTo(task.assigned_to_user_id != null ? String(task.assigned_to_user_id) : "");
    setEditNotes(task.notes || "");
    setEditError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdate = async (taskId: number) => {
    if (!editTitle.trim()) {
      setEditError("Title is required.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      await updateSteelMaintenanceTask(taskId, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        maintenance_type: editType || null,
        priority: editPriority || null,
        scheduled_date: editScheduledDate || null,
        assigned_to_user_id: editAssignedTo ? parseInt(editAssignedTo) : null,
        notes: editNotes.trim() || null,
      });
      setEditingId(null);
      await loadTasks();
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : "Could not update task.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (taskId: number) => {
    setDeletingId(taskId);
    try {
      await deleteSteelMaintenanceTask(taskId);
      setDeletingId(null);
      await loadTasks();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete task.");
      setDeletingId(null);
    }
  };

  const handleStatusUpdate = async (taskId: number, status: string) => {
    setUpdatingStatusId(taskId);
    try {
      await updateSteelMaintenanceTaskStatus(taskId, { status });
      setUpdatingStatusId(null);
      await loadTasks();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update status.");
      setUpdatingStatusId(null);
    }
  };

  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  const defaultDate = new Date(today.getTime() - offset).toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Maintenance Tasks — {machineName}</div>
          <div className="text-xs text-[var(--muted)]">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"  onClick={() => void loadTasks()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button  onClick={() => { setShowCreate(!showCreate); resetCreate(); }}>
            {showCreate ? "Cancel" : "Add Task"}
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
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Title *</label>
              <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="e.g. Inspect gearbox" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Description</label>
              <Textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Optional description" rows={2} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Type</label>
              <Select value={createType} onChange={(e) => setCreateType(e.target.value)}>
                {MAINTENANCE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Priority</label>
              <Select value={createPriority} onChange={(e) => setCreatePriority(e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Scheduled Date *</label>
              <Input type="date" value={createScheduledDate} onChange={(e) => setCreateScheduledDate(e.target.value)} min={defaultDate} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Assigned To (User ID)</label>
              <Input type="number" value={createAssignedTo} onChange={(e) => setCreateAssignedTo(e.target.value)} placeholder="Optional user ID" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">Notes</label>
              <Textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="Optional notes" rows={2} />
            </div>
          </div>
          {saveError ? <div className="mt-2 text-sm text-rose-400">{saveError}</div> : null}
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? "Saving..." : "Create Task"}
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      ) : null}

      {/* Tasks List */}
      {loading ? (
        <div className="py-4 text-center text-sm text-[var(--muted)]">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          No maintenance tasks for this machine yet.
        </div>
      ) : (
        <ResponsiveScrollArea className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]" debugLabel="maintenance-tasks-list">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Scheduled</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-[var(--border)]/60 last:border-none hover:bg-[rgba(62,166,255,0.04)]">
                  {editingId === task.id ? (
                    <>
                      <td className="px-3 py-2">
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-xs" placeholder="Title" />
                      </td>
                      <td className="px-3 py-2">
                        <Select value={editType} onChange={(e) => setEditType(e.target.value)} className="text-xs">
                          {MAINTENANCE_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Select value={editPriority} onChange={(e) => setEditPriority(e.target.value)} className="text-xs">
                          {PRIORITIES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">
                        <Select value={task.status} onChange={(e) => void handleStatusUpdate(task.id, e.target.value)} className="text-xs max-w-[110px]">
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s.replace("_", " ")}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input type="date" value={editScheduledDate} onChange={(e) => setEditScheduledDate(e.target.value)} className="text-xs w-32" />
                      </td>
                      <td className="px-3 py-2">
                        <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="text-xs" placeholder="Notes" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button  onClick={() => void handleUpdate(task.id)} disabled={editSaving}>
                            {editSaving ? "..." : "Save"}
                          </Button>
                          <Button  variant="outline" onClick={cancelEdit}>Cancel</Button>
                        </div>
                        {editError ? <div className="mt-1 text-xs text-rose-400">{editError}</div> : null}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2">
                        <div className="text-xs font-semibold text-white">{task.title}</div>
                        {task.description ? <div className="text-[10px] text-[var(--muted)]">{task.description}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)] capitalize">{task.maintenance_type}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${PRIORITY_COLORS[task.priority] || "border-[var(--border)] text-[var(--muted)]"}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${STATUS_COLORS[task.status] || "border-[var(--border)] text-[var(--muted)]"}`}>
                          {task.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">{formatDate(task.scheduled_date)}</td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">{task.notes || "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button  variant="outline" onClick={() => startEdit(task)}>Edit</Button>
                          <Button
                            
                            variant="outline"
                            className="border-rose-400/30 text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                            onClick={() => void handleDelete(task.id)}
                            disabled={deletingId === task.id}
                          >
                            {deletingId === task.id ? "..." : "Del"}
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
