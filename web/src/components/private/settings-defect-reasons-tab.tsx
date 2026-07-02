"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, formatApiErrorMessage } from "@/lib/api";
import {
  createDefectReason,
  deactivateDefectReason,
  listDefectReasons,
  updateDefectReason,
  type DefectReason,
} from "@/lib/settings";
import { pushAppToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  active: boolean;
};

type ModalMode = "add" | "edit";

type EditForm = {
  code: string;
  label: string;
  description: string;
};

function emptyForm(): EditForm {
  return { code: "", label: "", description: "" };
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function SettingsDefectReasonsTab({ active }: Props) {
  const [reasons, setReasons] = useState<DefectReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EditForm>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [deletePending, setDeletePending] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const loadReasons = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listDefectReasons(true);
      setReasons(data);
      setLoaded(true);
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not load defect reasons."));
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    if (!loaded && !loading) {
      void loadReasons();
    }
  }, [active, loaded, loading, loadReasons]);

  const visibleReasons = useMemo(
    () => (showInactive ? reasons : reasons.filter((r) => r.is_active)),
    [reasons, showInactive],
  );

  const openAddModal = () => {
    setModalMode("add");
    setEditId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEditModal = (reason: DefectReason) => {
    setModalMode("edit");
    setEditId(reason.id);
    setForm({
      code: reason.code,
      label: reason.label,
      description: reason.description || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditId(null);
    setForm(emptyForm());
  };

  const save = async () => {
    if (!form.code.trim() || !form.label.trim()) {
      pushAppToast({
        title: "Validation error",
        description: "Code and label are required.",
        tone: "error",
      });
      return;
    }
    setSaving(true);
    try {
      if (modalMode === "add") {
        await createDefectReason({
          code: form.code.trim(),
          label: form.label.trim(),
          description: form.description.trim() || null,
        });
        pushAppToast({
          title: "Defect reason created",
          description: `${form.code.trim()} was added.`,
          tone: "success",
        });
      } else if (editId != null) {
        await updateDefectReason(editId, {
          code: form.code.trim(),
          label: form.label.trim(),
          description: form.description.trim() || null,
        });
        pushAppToast({
          title: "Defect reason updated",
          description: `${form.code.trim()} was updated.`,
          tone: "success",
        });
      }
      closeModal();
      await loadReasons();
    } catch (err) {
      const message = formatApiErrorMessage(err, "Could not save defect reason.");
      pushAppToast({
        title: "Save failed",
        description: message,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (reason: DefectReason) => {
    if (!window.confirm(`Deactivate "${reason.code}" (${reason.label})? Entries using this reason will be preserved.`)) {
      return;
    }
    setDeletePending(reason.id);
    try {
      await deactivateDefectReason(reason.id);
      await loadReasons();
      pushAppToast({
        title: "Defect reason deactivated",
        description: `${reason.code} was deactivated.`,
        tone: "success",
      });
    } catch (err) {
      const message = formatApiErrorMessage(err, "Could not deactivate defect reason.");
      pushAppToast({
        title: "Deactivation failed",
        description: message,
        tone: "error",
      });
    } finally {
      setDeletePending(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">Defect Reasons</CardTitle>
            <div className="mt-2 text-sm text-[var(--muted)]">
              Manage the lookup table for quality defect categories. These appear in the entry form and quality intelligence
              dashboards.
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => void loadReasons()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-strong)] px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Show inactive
            </label>
            <Button onClick={openAddModal}>Add Reason</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !loaded ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="rounded-[24px] border border-[var(--border)] bg-[var(--card-strong)] p-5">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-[24px] border border-red-500/25 bg-red-500/8 p-5 text-sm text-red-100">
              <div className="font-semibold">Could not load defect reasons</div>
              <div className="mt-2">{error}</div>
              <div className="mt-4">
                <Button variant="outline" onClick={() => void loadReasons()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : visibleReasons.length ? (
            <div className="space-y-3">
              {visibleReasons.map((reason) => (
                <div
                  key={reason.id}
                  className={`rounded-[24px] border p-5 ${
                    reason.is_active
                      ? "border-[var(--border)] bg-[var(--card-strong)]"
                      : "border-[var(--border)]/60 bg-[rgba(255,255,255,0.03)] opacity-70"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-lg font-semibold text-white">{reason.label}</span>
                        <span className="rounded-full border border-[var(--border)] bg-white/5 px-3 py-1 text-[11px] font-mono uppercase tracking-label text-[var(--muted)]">
                          {reason.code}
                        </span>
                        {!reason.is_active ? (
                          <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-label text-amber-200">
                            Inactive
                          </span>
                        ) : null}
                      </div>
                      {reason.description ? (
                        <div className="mt-3 text-sm text-[var(--muted)]">{reason.description}</div>
                      ) : null}
                      <div className="mt-2 text-xs text-[var(--muted)]">
                        Created: {formatDateTime(reason.created_at)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => openEditModal(reason)} disabled={saving}>
                        Edit
                      </Button>
                      {reason.is_active ? (
                        <Button
                          variant="ghost"
                          onClick={() => void handleDeactivate(reason)}
                          disabled={deletePending === reason.id}
                          className="text-red-100"
                        >
                          {deletePending === reason.id ? "Deactivating..." : "Deactivate"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-[var(--border-strong)] bg-[rgba(11,16,26,0.6)] px-6 py-10 text-center">
              <div className="text-lg font-semibold text-white">No defect reasons yet.</div>
              <div className="mt-2 text-sm text-[var(--muted)]">
                Defect reasons are used in the entry form to categorize quality issues. Add the first one to get started.
              </div>
              <div className="mt-5">
                <Button onClick={openAddModal}>Add Reason</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Modal */}
      {modalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(3,7,18,0.72)] px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-[32px] border border-[var(--border)] bg-[rgba(11,16,25,0.98)] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
              <div>
                <div className="text-sm uppercase tracking-caption text-[var(--accent)]">Defect Reasons</div>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  {modalMode === "add" ? "Add Defect Reason" : "Edit Defect Reason"}
                </h3>
                {modalMode === "add" ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    The code is used internally to group entries; the label appears in dashboards and forms.
                  </p>
                ) : null}
              </div>
              <Button variant="ghost" onClick={closeModal} className="px-3 py-2 text-xs uppercase tracking-caption">
                Close
              </Button>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div>
                <label className="text-sm text-[var(--muted)]">Code</label>
                <Input
                  value={form.code}
                  onChange={(event) => setForm((curr) => ({ ...curr, code: event.target.value }))}
                  placeholder="surface_crack"
                  disabled={saving}
                />
                <div className="mt-1 text-xs text-[var(--muted)]">
                  Unique identifier used for grouping. Use snake_case.
                </div>
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Label</label>
                <Input
                  value={form.label}
                  onChange={(event) => setForm((curr) => ({ ...curr, label: event.target.value }))}
                  placeholder="Surface Crack"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((curr) => ({ ...curr, description: event.target.value }))}
                  placeholder="Cracks visible on the surface of the finished product..."
                  disabled={saving}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[rgba(12,18,28,0.8)] px-4 py-3 text-sm text-white placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                  rows={3}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="outline" onClick={closeModal} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={() => void save()} disabled={saving}>
                  {saving ? "Saving..." : modalMode === "add" ? "Create" : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
