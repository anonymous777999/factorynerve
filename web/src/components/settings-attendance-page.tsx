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
  const { user, activeFactory, loading, error: sessionError } = useSession();
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
      <main className="min-h-screen px-4 py-6 pb-24 md:px-8 md:pb-8">
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
            <div className="text-sm text-red-400">{sessionError || "Please login to continue."}</div>
            <Link href="/login"><Button>Open Login</Button></Link>
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
    <main className="min-h-screen px-4 py-6 pb-24 md:px-8 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.9)] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Attendance Admin</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Roster, shift, and review rules for {activeFactory?.name || user.factory_name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Map people to departments and default shifts, then define the shift windows that power punch, live board, and review logic.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/attendance/review" className="w-full sm:w-auto"><Button className="w-full sm:w-auto" variant="outline">Attendance Review</Button></Link>
              <Link href="/attendance/reports" className="w-full sm:w-auto"><Button className="w-full sm:w-auto" variant="outline">Attendance Reports</Button></Link>
            </div>
          </div>
        </section>

        {status ? <div className="rounded-2xl border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] px-4 py-3 text-sm text-emerald-100">{status}</div> : null}
        {error ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {sessionError ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{sessionError}</div> : null}

        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          <Button className="shrink-0" variant={tab === "employees" ? "primary" : "outline"} onClick={() => setTab("employees")}>Employee Profiles</Button>
          <Button className="shrink-0" variant={tab === "shifts" ? "primary" : "outline"} onClick={() => setTab("shifts")}>Shift Templates</Button>
        </div>

        {tab === "employees" ? (
          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="order-2 xl:order-1">
              <CardHeader><CardTitle className="text-xl">Factory Team</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {profiles.map((profile) => (
                  <button
                    key={profile.user_id}
                    type="button"
                    className={`w-full rounded-2xl border p-3.5 text-left transition sm:p-4 ${selectedUserId === String(profile.user_id) ? "border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.12)]" : "border-[var(--border)] bg-[var(--card-strong)]"}`}
                    onClick={() => applySelectedUser(String(profile.user_id))}
                  >
                    <div className="font-semibold text-[var(--text)]">{profile.name}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">ID {profile.user_code} | {profile.role} | {profile.department || "No department"}</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="order-1 xl:order-2">
              <CardHeader><CardTitle className="text-xl">Profile Editor</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-[var(--muted)]">Team Member</label>
                  <Select value={selectedUserId} onChange={(event) => applySelectedUser(event.target.value)}>
                    <option value="">Select a user</option>
                    {profiles.map((profile) => <option key={profile.user_id} value={profile.user_id}>{profile.name} ({profile.user_code})</option>)}
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="text-sm text-[var(--muted)]">Employee Code</label><Input value={employeeForm.employee_code} onChange={(event) => setEmployeeForm((current) => ({ ...current, employee_code: event.target.value }))} placeholder="EMP-102" /></div>
                  <div><label className="text-sm text-[var(--muted)]">Department</label><Input value={employeeForm.department} onChange={(event) => setEmployeeForm((current) => ({ ...current, department: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">Designation</label><Input value={employeeForm.designation} onChange={(event) => setEmployeeForm((current) => ({ ...current, designation: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">Employment Type</label><Input value={employeeForm.employment_type} onChange={(event) => setEmployeeForm((current) => ({ ...current, employment_type: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">Default Shift</label><Select value={employeeForm.default_shift} onChange={(event) => setEmployeeForm((current) => ({ ...current, default_shift: event.target.value }))}>{shiftTemplates.map((item) => <option key={item.id} value={item.shift_name}>{item.shift_name}</option>)}</Select></div>
                  <div><label className="text-sm text-[var(--muted)]">Joining Date</label><Input type="date" value={employeeForm.joining_date} onChange={(event) => setEmployeeForm((current) => ({ ...current, joining_date: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">Reporting Manager</label><Select value={employeeForm.reporting_manager_id} onChange={(event) => setEmployeeForm((current) => ({ ...current, reporting_manager_id: event.target.value }))}><option value="">No reporting manager</option>{managerOptions.map((item) => <option key={item.user_id} value={item.user_id}>{item.name}</option>)}</Select></div>
                  <div><label className="text-sm text-[var(--muted)]">Active Status</label><Select value={employeeForm.is_active ? "active" : "inactive"} onChange={(event) => setEmployeeForm((current) => ({ ...current, is_active: event.target.value === "active" }))}><option value="active">Active</option><option value="inactive">Inactive</option></Select></div>
                </div>
                <Button className="w-full sm:w-auto" onClick={() => void handleEmployeeSave()} disabled={busy || !employeeForm.user_id}>{busy ? "Saving..." : "Save Employee Profile"}</Button>
              </CardContent>
            </Card>
          </section>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="order-2 xl:order-1">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl">Shift Templates</CardTitle>
                <Button variant="ghost" onClick={() => { setSelectedShiftId(""); setShiftForm(emptyShiftForm()); }}>New</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {shiftTemplates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full rounded-2xl border p-3.5 text-left transition sm:p-4 ${selectedShiftId === String(item.id) ? "border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.12)]" : "border-[var(--border)] bg-[var(--card-strong)]"}`}
                    onClick={() => applySelectedShift(String(item.id))}
                  >
                    <div className="font-semibold text-[var(--text)]">{item.shift_name}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{item.start_time} to {item.end_time} | Grace {item.grace_minutes}m | OT after {item.overtime_after_minutes}m</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="order-1 xl:order-2">
              <CardHeader><CardTitle className="text-xl">Shift Editor</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><label className="text-sm text-[var(--muted)]">Template</label><Select value={selectedShiftId} onChange={(event) => applySelectedShift(event.target.value)}><option value="">Create new shift</option>{shiftTemplates.map((item) => <option key={item.id} value={item.id}>{item.shift_name}</option>)}</Select></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="text-sm text-[var(--muted)]">Shift Name</label><Input value={shiftForm.shift_name} onChange={(event) => setShiftForm((current) => ({ ...current, shift_name: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">Grace Minutes</label><Input type="number" min="0" max="180" step="1" value={shiftForm.grace_minutes} onChange={(event) => setShiftForm((current) => ({ ...current, grace_minutes: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">Start Time</label><Input type="time" value={shiftForm.start_time} onChange={(event) => setShiftForm((current) => ({ ...current, start_time: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">End Time</label><Input type="time" value={shiftForm.end_time} onChange={(event) => setShiftForm((current) => ({ ...current, end_time: event.target.value }))} /></div>
                  <div><label className="text-sm text-[var(--muted)]">OT After Minutes</label><Input type="number" min="0" max="1440" step="1" value={shiftForm.overtime_after_minutes} onChange={(event) => setShiftForm((current) => ({ ...current, overtime_after_minutes: event.target.value }))} /></div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[rgba(15,19,30,0.56)] p-4 sm:col-span-2">
                    <div className="text-sm font-medium text-[var(--text)]">Shift status</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm text-[var(--muted)]"><input type="checkbox" checked={shiftForm.cross_midnight} onChange={(event) => setShiftForm((current) => ({ ...current, cross_midnight: event.target.checked }))} />Cross midnight</label>
                      <label className="flex items-center gap-2 text-sm text-[var(--muted)]"><input type="checkbox" checked={shiftForm.is_default} onChange={(event) => setShiftForm((current) => ({ ...current, is_default: event.target.checked }))} />Default shift</label>
                      <label className="flex items-center gap-2 text-sm text-[var(--muted)] sm:col-span-2"><input type="checkbox" checked={shiftForm.is_active} onChange={(event) => setShiftForm((current) => ({ ...current, is_active: event.target.checked }))} />Active</label>
                    </div>
                  </div>
                </div>
                <Button className="w-full sm:w-auto" onClick={() => void handleShiftSave()} disabled={busy || !shiftForm.shift_name}>{busy ? "Saving..." : "Save Shift Template"}</Button>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}
