"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { SafeText } from "@/components/ui/safe-text";
import { Select } from "@/components/ui/select";
import type { ManagedUser, ManagedUserFactoryAccessPayload } from "@/lib/settings";

type SettingsUsersTabProps = {
  accessFactoryIds: string[];
  accessLoading: boolean;
  accessSnapshot: ManagedUserFactoryAccessPayload | null;
  accessUserId: string;
  assignableRoles: string[];
  busy: boolean;
  canManageFactoryAccess: boolean;
  deactivateUserId: string;
  downgradeConfirm: string;
  inviteEmail: string;
  inviteName: string;
  inviteRole: string;
  newRole: string;
  roleUserId: string;
  users: ManagedUser[];
  onAccessUserIdChange: (value: string) => void;
  onDeactivateUserIdChange: (value: string) => void;
  onDowngradeConfirmChange: (value: string) => void;
  onInviteEmailChange: (value: string) => void;
  onInviteNameChange: (value: string) => void;
  onInviteRoleChange: (value: string) => void;
  onNewRoleChange: (value: string) => void;
  onRoleUserIdChange: (value: string) => void;
  onInviteUser: () => void;
  onSaveFactoryAccess: () => void;
  onToggleAccessFactory: (factoryId: string) => void;
  onUpdateRole: () => void;
  onDeactivateUser: () => void;
};

export function SettingsUsersTab({
  accessFactoryIds,
  accessLoading,
  accessSnapshot,
  accessUserId,
  assignableRoles,
  busy,
  canManageFactoryAccess,
  deactivateUserId,
  downgradeConfirm,
  inviteEmail,
  inviteName,
  inviteRole,
  newRole,
  roleUserId,
  users,
  onAccessUserIdChange,
  onDeactivateUserIdChange,
  onDowngradeConfirmChange,
  onInviteEmailChange,
  onInviteNameChange,
  onInviteRoleChange,
  onNewRoleChange,
  onRoleUserIdChange,
  onInviteUser,
  onSaveFactoryAccess,
  onToggleAccessFactory,
  onUpdateRole,
  onDeactivateUser,
}: SettingsUsersTabProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-xl">Users</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          {users.length ? (
            <>
              <div className="grid gap-3 md:hidden">
                {users.map((row) => (
                  <div
                    key={row.id}
                    className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs uppercase tracking-label text-[var(--muted)]">
                          User #{row.user_code}
                        </div>
                        <SafeText as="div" className="mt-1 text-sm font-semibold">
                          {row.name}
                        </SafeText>
                        <SafeText as="div" className="mt-1 text-xs text-[var(--muted)]">
                          {row.email}
                        </SafeText>
                      </div>
                      <span className="rounded-full border border-[var(--border)] px-3 py-1 text-[11px] font-semibold uppercase tracking-label text-[var(--muted)]">
                        {row.role}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--border)]/70 bg-[rgba(15,23,42,0.34)] p-3">
                        <div className="text-[11px] uppercase tracking-label text-[var(--muted)]">
                          Factory Access
                        </div>
                        <div className="mt-1 text-sm font-medium">
                          {row.factory_count === 1 ? "1 factory" : `${row.factory_count} factories`}
                        </div>
                        <SafeText as="div" className="mt-1 text-xs text-[var(--muted)]">
                          {row.factory_name}
                        </SafeText>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-[var(--border)]/70 bg-[rgba(15,23,42,0.34)] p-3">
                          <div className="text-[11px] uppercase tracking-label text-[var(--muted)]">
                            Plan
                          </div>
                          <div className="mt-1 text-sm font-medium">{row.plan}</div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)]/70 bg-[rgba(15,23,42,0.34)] p-3">
                          <div className="text-[11px] uppercase tracking-label text-[var(--muted)]">
                            Active
                          </div>
                          <div className="mt-1 text-sm font-medium">{row.is_active ? "Yes" : "No"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <ResponsiveScrollArea
                  debugLabel="settings-managed-users"
                  viewportClassName="-mx-1 px-1 pb-2"
                  innerClassName="min-w-[860px]"
                >
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">User ID</th>
                        <th className="px-3 py-3 font-medium">Name</th>
                        <th className="px-3 py-3 font-medium">Email</th>
                        <th className="px-3 py-3 font-medium">Role</th>
                        <th className="px-3 py-3 font-medium">Factory Access</th>
                        <th className="px-3 py-3 font-medium">Plan</th>
                        <th className="px-3 py-3 font-medium">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((row) => (
                        <tr key={row.id} className="border-b border-[var(--border)]/60 align-top">
                          <td className="px-3 py-3 font-semibold">{row.user_code}</td>
                          <td className="px-3 py-3">
                            <SafeText>{row.name}</SafeText>
                          </td>
                          <td className="px-3 py-3">
                            <SafeText>{row.email}</SafeText>
                          </td>
                          <td className="px-3 py-3">{row.role}</td>
                          <td className="px-3 py-3">
                            <div>{row.factory_count === 1 ? "1 factory" : `${row.factory_count} factories`}</div>
                            <SafeText as="div" className="mt-1 text-xs text-[var(--muted)]">
                              {row.factory_name}
                            </SafeText>
                          </td>
                          <td className="px-3 py-3">{row.plan}</td>
                          <td className="px-3 py-3">{row.is_active ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveScrollArea>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
              No managed users found.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-6">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-xl">Invite User</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            <div>
              <label className="text-sm text-[var(--muted)]">Name</label>
              <Input value={inviteName} onChange={(e) => onInviteNameChange(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Email</label>
              <Input type="email" value={inviteEmail} onChange={(e) => onInviteEmailChange(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Role</label>
              <Select value={inviteRole} onChange={(e) => onInviteRoleChange(e.target.value)}>
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={onInviteUser} disabled={busy} className="w-full sm:w-auto">
              Invite User
            </Button>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-xl">Factory Access</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            {canManageFactoryAccess ? (
              <>
                <div>
                  <label className="text-sm text-[var(--muted)]">User</label>
                  <Select value={accessUserId} onChange={(e) => onAccessUserIdChange(e.target.value)}>
                    <option value="">Select a user</option>
                    {users.map((managedUser) => (
                      <option key={managedUser.id} value={managedUser.id}>
                        #{managedUser.user_code} {managedUser.name} - {managedUser.role}
                      </option>
                    ))}
                  </Select>
                </div>
                {accessLoading ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                    Loading factory access...
                  </div>
                ) : accessSnapshot ? (
                  <>
                    <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <SafeText as="div" className="text-sm font-semibold">
                        {accessSnapshot.user.name}
                      </SafeText>
                      <div className="mt-1 overflow-safe-text text-xs text-[var(--muted)]">
                        #{accessSnapshot.user.user_code} - {accessSnapshot.user.role} -{" "}
                        {accessSnapshot.user.factory_count} assigned
                      </div>
                    </div>
                    <div className="space-y-3">
                      {accessSnapshot.factories.map((factoryOption) => {
                        const checked = accessFactoryIds.includes(factoryOption.factory_id);
                        return (
                          <label
                            key={factoryOption.factory_id}
                            className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 sm:flex-row sm:items-start sm:justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <SafeText as="div" className="text-sm font-semibold">
                                {factoryOption.name}
                              </SafeText>
                              <div className="mt-1 overflow-safe-text text-xs text-[var(--muted)]">
                                {factoryOption.industry_label} - Members {factoryOption.member_count}
                                {factoryOption.is_primary ? " - Primary context" : ""}
                              </div>
                              {factoryOption.location ? (
                                <SafeText as="div" className="mt-1 text-xs text-[var(--muted)]">
                                  {factoryOption.location}
                                </SafeText>
                              ) : null}
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggleAccessFactory(factoryOption.factory_id)}
                              className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                            />
                          </label>
                        );
                      })}
                    </div>
                    <div className="overflow-safe-text text-xs text-[var(--muted)]">
                      Owners and admins can place one user across multiple factories. At least one factory must stay
                      selected.
                    </div>
                    <Button
                      onClick={onSaveFactoryAccess}
                      disabled={busy || !accessSnapshot || !accessFactoryIds.length}
                      className="w-full sm:w-auto"
                    >
                      Save Factory Access
                    </Button>
                  </>
                ) : (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                    Choose a user to manage factory membership.
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                Multi-factory access is managed by admins and owners.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-xl">Update Role / Deactivate</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            <div>
              <label className="text-sm text-[var(--muted)]">User Code or ID</label>
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={roleUserId}
                onChange={(e) => onRoleUserIdChange(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">New Role</label>
              <Select value={newRole} onChange={(e) => onNewRoleChange(e.target.value)}>
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Type DOWNGRADE to confirm lower roles</label>
              <Input value={downgradeConfirm} onChange={(e) => onDowngradeConfirmChange(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={onUpdateRole} disabled={busy || !roleUserId} className="w-full sm:w-auto">
                Update Role
              </Button>
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <label className="text-sm text-[var(--muted)]">Deactivate User Code or ID</label>
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={deactivateUserId}
                onChange={(e) => onDeactivateUserIdChange(e.target.value)}
              />
              <div className="mt-3">
                <Button
                  variant="outline"
                  onClick={onDeactivateUser}
                  disabled={busy || !deactivateUserId}
                  className="w-full sm:w-auto"
                >
                  Deactivate User
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
