"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import {
  listAttendanceEmployeeProfiles,
  listShiftTemplates,
  upsertAttendanceEmployeeProfile,
  upsertShiftTemplate,
  type EmployeeProfileItem,
  type ShiftTemplateItem,
} from "@/lib/attendance";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { validateIdentifierCode } from "@/lib/validation";

type SettingsTab = "employees" | "shifts";

function canManageAttendance(role?: string | null) {
  return ["manager", "admin", "owner"].includes(role || "");
}

function emptyEmployeeForm() {
  return {
    user_id: 0,
    employee_code: "",
    department: "",
    designation: "",
    employment_type: "permanent",
    reporting_manager_id: "",
    default_shift: "morning",
    joining_date: "",
    is_active: true,
  };
}

function emptyShiftForm() {
  return {
    id: "",
    shift_name: "",
    start_time: "06:00",
    end_time: "14:00",
    grace_minutes: "10",
    overtime_after_minutes: "480",
    cross_midnight: false,
    is_default: false,
    is_active: true,
  };
}

function parseIntegerField(
  value: string,
  label: string,
  { min, max }: { min: number; max: number },
) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be a whole number.`);
  }
  if (parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return parsed;
}

export default function SettingsAttendancePage() {
  const { user, loading, error: sessionError } = useSession();
  const [tab, setTab] = useState<SettingsTab>("employees");
  const [profiles, setProfiles] = useState<EmployeeProfileItem[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplateItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm());
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [shiftForm, setShiftForm] = useState(emptyShiftForm());
  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const canManage = canManageAttendance(user?.role);

  const loadAll = useCallback(async () => {
    if (!user || !canManage) return;
    setPageLoading(true);
    setError("");
    try {
      const [profilesPayload, shiftsPayload] = await Promise.all([
        listAttendanceEmployeeProfiles(),
        listShiftTemplates(),
      ]);
      setProfiles(profilesPayload);
      setShiftTemplates(shiftsPayload);
      if (profilesPayload.length && !selectedUserId) {
        const first = profilesPayload[0];
        setSelectedUserId(String(first.user_id));
        setEmployeeForm({
          user_id: first.user_id,
          employee_code: first.employee_code || "",
          department: first.department || "",
          designation: first.designation || "",
          employment_type: first.employment_type || "permanent",
          reporting_manager_id: first.reporting_manager_id ? String(first.reporting_manager_id) : "",
          default_shift: first.default_shift || "morning",
          joining_date: first.joining_date || "",
          is_active: first.is_active,
        });
      }
      if (shiftsPayload.length && !selectedShiftId) {
        const firstShift = shiftsPayload[0];
        setSelectedShiftId(String(firstShift.id));
        setShiftForm({
          id: String(firstShift.id),
          shift_name: firstShift.shift_name,
          start_time: firstShift.start_time,
          end_time: firstShift.end_time,
          grace_minutes: String(firstShift.grace_minutes),
          overtime_after_minutes: String(firstShift.overtime_after_minutes),
          cross_midnight: firstShift.cross_midnight,
          is_default: firstShift.is_default,
          is_active: firstShift.is_active,
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not load attendance settings.");
      }
    } finally {
      setPageLoading(false);
    }
  }, [canManage, selectedShiftId, selectedUserId, user]);

  useEffect(() => {
    if (!user || !canManage) return;
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canManage, loadAll, user]);

  const managerOptions = useMemo(
    () => profiles.filter((item) => ["supervisor", "manager", "admin", "owner"].includes(item.role)),
    [profiles],
  );

  function applySelectedUser(userId: string) {
    setSelectedUserId(userId);
    const profile = profiles.find((item) => String(item.user_id) === userId);
    if (!profile) {
      setEmployeeForm(emptyEmployeeForm());
      return;
    }
    setEmployeeForm({
      user_id: profile.user_id,
      employee_code: profile.employee_code || "",
      department: profile.department || "",
      designation: profile.designation || "",
      employment_type: profile.employment_type || "permanent",
      reporting_manager_id: profile.reporting_manager_id ? String(profile.reporting_manager_id) : "",
      default_shift: profile.default_shift || "morning",
      joining_date: profile.joining_date || "",
      is_active: profile.is_active,
    });
  }

  function applySelectedShift(shiftId: string) {
    setSelectedShiftId(shiftId);
    const template = shiftTemplates.find((item) => String(item.id) === shiftId);
    if (!template) {
      setShiftForm(emptyShiftForm());
      return;
    }
    setShiftForm({
      id: String(template.id),
      shift_name: template.shift_name,
      start_time: template.start_time,
      end_time: template.end_time,
      grace_minutes: String(template.grace_minutes),
      overtime_after_minutes: String(template.overtime_after_minutes),
      cross_midnight: template.cross_midnight,
      is_default: template.is_default,
      is_active: template.is_active,
    });
  }

  async function handleEmployeeSave() {
    setStatus("");
    setError("");
    try {
      const employeeCodeError = validateIdentifierCode(employeeForm.employee_code, "Employee code");
      if (employeeCodeError) {
        throw new Error(employeeCodeError);
      }
      const reportingManagerId = employeeForm.reporting_manager_id
        ? parseIntegerField(employeeForm.reporting_manager_id, "Reporting manager", { min: 1, max: 999999999 })
        : null;
      setBusy(true);
      await upsertAttendanceEmployeeProfile({
        user_id: employeeForm.user_id,
        employee_code: employeeForm.employee_code || null,
        department: employeeForm.department || null,
        designation: employeeForm.designation || null,
        employment_type: employeeForm.employment_type,
        reporting_manager_id: reportingManagerId,
        default_shift: employeeForm.default_shift,
        joining_date: employeeForm.joining_date || null,
        is_active: employeeForm.is_active,
      });
      setStatus("Employee attendance profile saved.");
      await loadAll();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not save employee profile.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleShiftSave() {
    setStatus("");
    setError("");
    try {
      const graceMinutes = parseIntegerField(shiftForm.grace_minutes, "Grace minutes", { min: 0, max: 180 });
      const overtimeAfterMinutes = parseIntegerField(shiftForm.overtime_after_minutes, "OT after minutes", {
        min: 0,
        max: 1440,
      });
      setBusy(true);
      await upsertShiftTemplate({
        id: shiftForm.id ? Number(shiftForm.id) : null,
        shift_name: shiftForm.shift_name,
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        grace_minutes: graceMinutes,
        overtime_after_minutes: overtimeAfterMinutes,
        cross_midnight: shiftForm.cross_midnight,
        is_default: shiftForm.is_default,
        is_active: shiftForm.is_active,
      });
      setStatus("Shift template saved.");
      await loadAll();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not save shift template.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading || (pageLoading && user && canManage)) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-36 rounded-[2rem]" />
          <Skeleton className="h-[40rem] rounded-2xl" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader><CardTitle>Attendance Admin</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please sign in to continue."}</div>
            <Link href="/access"><Button>Open Access</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader><CardTitle>Attendance Admin</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">Attendance settings are available to manager, admin, and owner roles.</div>
            <Link href="/attendance"><Button>Open Attendance</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.9)] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Attendance Admin</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Keep roster and shifts ready for review</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Update the team profile first, then shape the shift windows that power punch, live board, and review logic.
              </p>
            </div>
            {/* AUDIT: BUTTON_CLUTTER - move companion attendance routes into a secondary tray so the active admin editor stays primary. */}
            <details className="group w-full min-w-0 rounded-3xl border border-[var(--border)] bg-[rgba(10,16,26,0.72)] sm:w-auto sm:min-w-[220px]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                Attendance tools
                <span className="text-xs text-[var(--muted)] transition group-open:hidden">Open</span>
                <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
              </summary>
              <div className="flex flex-wrap gap-3 border-t border-[var(--border)] px-4 py-4">
                <Link href="/attendance/review"><Button variant="outline">Review</Button></Link>
                <Link href="/attendance/reports"><Button variant="outline">Reports</Button></Link>
              </div>
            </details>
          </div>
        </section>

        {/* AUDIT: FLOW_BROKEN - add a short setup path so the page clearly points from team setup to shift rules. */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">1. Pick a lane</div>
              <CardTitle className="text-lg">{tab === "employees" ? "Edit team profiles" : "Edit shift templates"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Use the tabs to keep one admin task open at a time instead of working across both forms together.
            </CardContent>
          </Card>
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">2. Update details</div>
              <CardTitle className="text-lg">Save the active editor</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Keep the selected profile or shift template focused until the form is saved successfully.
            </CardContent>
          </Card>
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">3. Review output</div>
              <CardTitle className="text-lg">Use review and reports later</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Review and reports stay available in the tools tray once the active admin update is done.
            </CardContent>
          </Card>
        </section>

        {status ? <div className="rounded-2xl border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] px-4 py-3 text-sm text-emerald-100">{status}</div> : null}
        {error ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {sessionError ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{sessionError}</div> : null}

        <div className="flex flex-wrap gap-2">
          <Button variant={tab === "employees" ? "primary" : "outline"} onClick={() => setTab("employees")}>Team</Button>
          <Button variant={tab === "shifts" ? "primary" : "outline"} onClick={() => setTab("shifts")}>Shifts</Button>
        </div>

        {tab === "employees" ? (
          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader><CardTitle className="text-xl">Factory Team</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {profiles.map((profile) => (
                  <button
                    key={profile.user_id}
                    type="button"
                    className={`w-full rounded-2xl border p-4 text-left transition ${selectedUserId === String(profile.user_id) ? "border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.12)]" : "border-[var(--border)] bg-[var(--card-strong)]"}`}
                    onClick={() => applySelectedUser(String(profile.user_id))}
                  >
                    <div className="font-semibold text-[var(--text)]">{profile.name}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">ID {profile.user_code} | {profile.role} | {profile.department || "No department"}</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-xl">Profile Editor</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-[var(--muted)]">Team Member</label>
                  <Select value={selectedUserId} onChange={(event) => applySelectedUser(event.target.value)}>
                    <option value="">Select a user</option>
                    {profiles.map((profile) => <option key={profile.user_id} value={profile.user_id}>{profile.name} ({profile.user_code})</option>)}
                  </Select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div><label className="text-sm text-[var(--muted)]">Employee Code</label><Input value={employeeForm.employee_code} onChange={(event) => setEmployeeForm((current) => ({ ...current, employee_code: event.target.value }))} placeholder="EMP-102" /></div>
                  <div><label className="text-sm text-[var(--muted)]">Department</label><Input value={employeeForm.department} onChange={(event) => setEmployeeForm((current) => ({ ...current, department: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">Designation</label><Input value={employeeForm.designation} onChange={(event) => setEmployeeForm((current) => ({ ...current, designation: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">Employment Type</label><Input value={employeeForm.employment_type} onChange={(event) => setEmployeeForm((current) => ({ ...current, employment_type: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">Default Shift</label><Select value={employeeForm.default_shift} onChange={(event) => setEmployeeForm((current) => ({ ...current, default_shift: event.target.value }))}>{shiftTemplates.map((item) => <option key={item.id} value={item.shift_name}>{item.shift_name}</option>)}</Select></div>
                  <div><label className="text-sm text-[var(--muted)]">Joining Date</label><Input type="date" value={employeeForm.joining_date} onChange={(event) => setEmployeeForm((current) => ({ ...current, joining_date: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">Reporting Manager</label><Select value={employeeForm.reporting_manager_id} onChange={(event) => setEmployeeForm((current) => ({ ...current, reporting_manager_id: event.target.value }))}><option value="">No reporting manager</option>{managerOptions.map((item) => <option key={item.user_id} value={item.user_id}>{item.name}</option>)}</Select></div>
                  <div><label className="text-sm text-[var(--muted)]">Active Status</label><Select value={employeeForm.is_active ? "active" : "inactive"} onChange={(event) => setEmployeeForm((current) => ({ ...current, is_active: event.target.value === "active" }))}><option value="active">Active</option><option value="inactive">Inactive</option></Select></div>
                </div>
                <Button onClick={() => void handleEmployeeSave()} disabled={busy || !employeeForm.user_id}>{busy ? "Saving..." : "Save profile"}</Button>
              </CardContent>
            </Card>
          </section>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl">Shift Templates</CardTitle>
                <Button variant="ghost" onClick={() => { setSelectedShiftId(""); setShiftForm(emptyShiftForm()); }}>New</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {shiftTemplates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full rounded-2xl border p-4 text-left transition ${selectedShiftId === String(item.id) ? "border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.12)]" : "border-[var(--border)] bg-[var(--card-strong)]"}`}
                    onClick={() => applySelectedShift(String(item.id))}
                  >
                    <div className="font-semibold text-[var(--text)]">{item.shift_name}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{item.start_time} to {item.end_time} | Grace {item.grace_minutes}m | OT after {item.overtime_after_minutes}m</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-xl">Shift Editor</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><label className="text-sm text-[var(--muted)]">Template</label><Select value={selectedShiftId} onChange={(event) => applySelectedShift(event.target.value)}><option value="">Create new shift</option>{shiftTemplates.map((item) => <option key={item.id} value={item.id}>{item.shift_name}</option>)}</Select></div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div><label className="text-sm text-[var(--muted)]">Shift Name</label><Input value={shiftForm.shift_name} onChange={(event) => setShiftForm((current) => ({ ...current, shift_name: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">Grace Minutes</label><Input type="number" min="0" max="180" step="1" value={shiftForm.grace_minutes} onChange={(event) => setShiftForm((current) => ({ ...current, grace_minutes: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">Start Time</label><Input type="time" value={shiftForm.start_time} onChange={(event) => setShiftForm((current) => ({ ...current, start_time: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">End Time</label><Input type="time" value={shiftForm.end_time} onChange={(event) => setShiftForm((current) => ({ ...current, end_time: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">OT After Minutes</label><Input type="number" min="0" max="1440" step="1" value={shiftForm.overtime_after_minutes} onChange={(event) => setShiftForm((current) => ({ ...current, overtime_after_minutes: event.target.value }))} /></div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="mt-6 flex items-center gap-2 text-sm text-[var(--muted)]"><input type="checkbox" checked={shiftForm.cross_midnight} onChange={(event) => setShiftForm((current) => ({ ...current, cross_midnight: event.target.checked }))} />Cross midnight</label>
                    <label className="mt-6 flex items-center gap-2 text-sm text-[var(--muted)]"><input type="checkbox" checked={shiftForm.is_default} onChange={(event) => setShiftForm((current) => ({ ...current, is_default: event.target.checked }))} />Default shift</label>
                    <label className="flex items-center gap-2 text-sm text-[var(--muted)]"><input type="checkbox" checked={shiftForm.is_active} onChange={(event) => setShiftForm((current) => ({ ...current, is_active: event.target.checked }))} />Active</label>
                  </div>
                </div>
                <Button onClick={() => void handleShiftSave()} disabled={busy || !shiftForm.shift_name}>{busy ? "Saving..." : "Save shift"}</Button>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}
