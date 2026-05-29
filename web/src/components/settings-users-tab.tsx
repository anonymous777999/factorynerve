"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Label } from "@/components/ui/field";
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
    <div className="control-center-workspace grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="min-w-0 bg-[#151b24] border-cyan-900/30">
        <CardHeader>
          <CardTitle className="text-xl font-mono text-cyan-400 uppercase tracking-wider">GOVERNANCE_REGISTRY</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          {users.length ? (
            <>
              <div className="grid gap-3 md:hidden">
                {users.map((row) => (
                  <div
                    key={row.id}
                    className="min-w-0 rounded-2xl border border-cyan-900/30 bg-[#0a0e14] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs uppercase tracking-[0.16em] text-gray-500 font-mono">
                          USER_ID #{row.user_code}
                        </div>
                        <SafeText as="div" className="mt-1 text-sm font-semibold font-mono text-cyan-300">
                          {row.name}
                        </SafeText>
                        <SafeText as="div" className="mt-1 text-xs text-gray-400 font-mono">
                          {row.email}
                        </SafeText>
                      </div>
                      <span className="rounded-full bg-cyan-900/30 border border-cyan-700 px-3 py-1 text-[12px] font-medium text-cyan-300 font-mono uppercase">
                        {row.role}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-cyan-900/30 bg-[#151b24] p-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-gray-500 font-mono">
                          FACTORY_ACCESS
                        </div>
                        <div className="mt-1 text-sm font-medium font-mono text-cyan-300">
                          {row.factory_count === 1 ? "1 FACTORY" : `${row.factory_count} FACTORIES`}
                        </div>
                        <SafeText as="div" className="mt-1 text-xs text-gray-400 font-mono">
                          {row.factory_name}
                        </SafeText>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-cyan-900/30 bg-[#151b24] p-3">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-gray-500 font-mono">
                            PLAN
                          </div>
                          <div className="mt-1 text-sm font-medium font-mono text-cyan-300">{row.plan}</div>
                        </div>
                        <div className="rounded-2xl border border-cyan-900/30 bg-[#151b24] p-3">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-gray-500 font-mono">
                            STATUS
                          </div>
                          <div className="mt-1 text-sm font-medium font-mono text-cyan-300">{row.is_active ? "ACTIVE" : "INACTIVE"}</div>
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
                  <table className="min-w-full text-left text-sm font-mono">
                    <thead className="text-gray-500">
                      <tr className="border-b border-cyan-900/30">
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wider">USER_ID</th>
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wider">NAME</th>
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wider">EMAIL</th>
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wider">ROLE</th>
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wider">FACTORY_ACCESS</th>
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wider">PLAN</th>
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wider">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((row) => (
                        <tr key={row.id} className="border-b border-cyan-900/30 align-top">
                          <td className="px-3 py-3 font-semibold text-cyan-400">#{row.user_code}</td>
                          <td className="px-3 py-3 text-cyan-300">
                            <SafeText>{row.name}</SafeText>
                          </td>
                          <td className="px-3 py-3 text-gray-400">
                            <SafeText>{row.email}</SafeText>
                          </td>
                          <td className="px-3 py-3 text-cyan-300 uppercase">{row.role}</td>
                          <td className="px-3 py-3">
                            <div className="text-cyan-300">{row.factory_count === 1 ? "1 FACTORY" : `${row.factory_count} FACTORIES`}</div>
                            <SafeText as="div" className="mt-1 text-xs text-gray-500">
                              {row.factory_name}
                            </SafeText>
                          </td>
                          <td className="px-3 py-3 text-cyan-300">{row.plan}</td>
                          <td className="px-3 py-3 text-cyan-300">{row.is_active ? "ACTIVE" : "INACTIVE"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveScrollArea>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-cyan-900/30 bg-[#0a0e14] p-4 text-sm text-gray-400 font-mono">
              NO_USERS_FOUND
            </div>
          )}
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-6">
        <Card className="min-w-0 bg-[#151b24] border-cyan-900/30">
          <CardHeader>
            <CardTitle className="text-xl font-mono text-cyan-400 uppercase tracking-wider">INVITE_NEW_USER</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            <Field>
              <Label className="font-mono text-xs uppercase tracking-wider text-gray-400">USER_NAME</Label>
              <Input
                value={inviteName}
                onChange={(e) => onInviteNameChange(e.target.value)}
                className="bg-[#0a0e14] border-cyan-900/30 text-cyan-300 font-mono focus:border-cyan-500"
              />
            </Field>
            <Field>
              <Label className="font-mono text-xs uppercase tracking-wider text-gray-400">EMAIL_ADDRESS</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => onInviteEmailChange(e.target.value)}
                className="bg-[#0a0e14] border-cyan-900/30 text-cyan-300 font-mono focus:border-cyan-500"
              />
            </Field>
            <Field>
              <Label className="font-mono text-xs uppercase tracking-wider text-gray-400">SYSTEM_ROLE</Label>
              <Select
                value={inviteRole}
                onChange={(e) => onInviteRoleChange(e.target.value)}
                className="bg-[#0a0e14] border-cyan-900/30 text-cyan-300 font-mono focus:border-cyan-500"
              >
                {assignableRoles.map((role) => (
                  <option key={role} value={role} className="bg-[#0a0e14] text-cyan-300">
                    {role.toUpperCase()}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              onClick={onInviteUser}
              disabled={busy}
              className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-700 text-white font-mono uppercase tracking-wider"
            >
              GENERATE_INVITATION
            </Button>
          </CardContent>
        </Card>

        <Card className="min-w-0 bg-[#151b24] border-cyan-900/30">
          <CardHeader>
            <CardTitle className="text-xl font-mono text-cyan-400 uppercase tracking-wider">FACTORY_ACCESS</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            {canManageFactoryAccess ? (
              <>
                <Field>
                  <Label className="font-mono text-xs uppercase tracking-wider text-gray-400">SELECT_USER</Label>
                  <Select
                    value={accessUserId}
                    onChange={(e) => onAccessUserIdChange(e.target.value)}
                    className="bg-[#0a0e14] border-cyan-900/30 text-cyan-300 font-mono focus:border-cyan-500"
                  >
                    <option value="" className="bg-[#0a0e14]">SELECT_USER</option>
                    {users.map((managedUser) => (
                      <option key={managedUser.id} value={managedUser.id} className="bg-[#0a0e14] text-cyan-300">
                        #{managedUser.user_code} {managedUser.name} - {managedUser.role.toUpperCase()}
                      </option>
                    ))}
                  </Select>
                </Field>
                {accessLoading ? (
                  <div className="rounded-2xl border border-cyan-900/30 bg-[#0a0e14] p-4 text-sm text-gray-400 font-mono">
                    LOADING_ACCESS_DATA...
                  </div>
                ) : accessSnapshot ? (
                  <>
                    <div className="min-w-0 rounded-2xl border border-cyan-900/30 bg-[#0a0e14] p-4">
                      <SafeText as="div" className="text-sm font-semibold font-mono text-cyan-300">
                        {accessSnapshot.user.name}
                      </SafeText>
                      <div className="mt-1 overflow-safe-text text-xs text-gray-400 font-mono">
                        #{accessSnapshot.user.user_code} - {accessSnapshot.user.role.toUpperCase()} -{" "}
                        {accessSnapshot.user.factory_count} ASSIGNED
                      </div>
                    </div>
                    <div className="space-y-3">
                      {accessSnapshot.factories.map((factoryOption) => {
                        const checked = accessFactoryIds.includes(factoryOption.factory_id);
                        return (
                          <label
                            key={factoryOption.factory_id}
                            className="flex min-w-0 flex-col gap-4 rounded-2xl border border-cyan-900/30 bg-[#0a0e14] p-4 sm:flex-row sm:items-start sm:justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <SafeText as="div" className="text-sm font-semibold font-mono text-cyan-300">
                                {factoryOption.name}
                              </SafeText>
                              <div className="mt-1 overflow-safe-text text-xs text-gray-400 font-mono">
                                {factoryOption.industry_label} - MEMBERS: {factoryOption.member_count}
                                {factoryOption.is_primary ? " - PRIMARY_NODE" : ""}
                              </div>
                              {factoryOption.location ? (
                                <SafeText as="div" className="mt-1 text-xs text-gray-500 font-mono">
                                  {factoryOption.location}
                                </SafeText>
                              ) : null}
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggleAccessFactory(factoryOption.factory_id)}
                              className="mt-1 h-4 w-4 shrink-0 accent-cyan-600"
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
            <Field>
              <Label>User Code or ID</Label>
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={roleUserId}
                onChange={(e) => onRoleUserIdChange(e.target.value)}
              />
            </Field>
            <Field>
              <Label>New Role</Label>
              <Select value={newRole} onChange={(e) => onNewRoleChange(e.target.value)}>
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>Type DOWNGRADE to confirm lower roles</Label>
              <Input value={downgradeConfirm} onChange={(e) => onDowngradeConfirmChange(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button onClick={onUpdateRole} disabled={busy || !roleUserId} className="w-full sm:w-auto">
                Update Role
              </Button>
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <Field>
                <Label>Deactivate User Code or ID</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={deactivateUserId}
                  onChange={(e) => onDeactivateUserIdChange(e.target.value)}
                />
              </Field>
              <div className="mt-3">
                <Button
                  variant="destructive"
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
