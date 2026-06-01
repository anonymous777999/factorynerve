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
      <Card className="min-w-0 bg-surface-card border-border-subtle">
        <CardHeader>
          <CardTitle className="text-xl text-text-primary">Governance registry</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          {users.length ? (
            <>
              <div className="grid gap-3 md:hidden">
                {users.map((row) => (
                  <div
                    key={row.id}
                    className="min-w-0 rounded-2xl border border-border-subtle bg-surface-panel p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs uppercase tracking-wide text-text-tertiary">
                          User ID #{row.user_code}
                        </div>
                        <SafeText as="div" className="mt-1 text-sm font-semibold text-text-primary">
                          {row.name}
                        </SafeText>
                        <SafeText as="div" className="mt-1 text-xs text-text-secondary">
                          {row.email}
                        </SafeText>
                      </div>
                      <span className="rounded-full border border-border-subtle bg-surface-panel px-3 py-1 text-[12px] font-medium text-text-secondary capitalize">
                        {row.role}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border-subtle bg-surface-card p-3">
                        <div className="text-[11px] uppercase tracking-wide text-text-tertiary">
                          Factory access
                        </div>
                        <div className="mt-1 text-sm font-medium text-text-primary">
                          {row.factory_count === 1 ? "1 factory" : `${row.factory_count} factories`}
                        </div>
                        <SafeText as="div" className="mt-1 text-xs text-text-secondary">
                          {row.factory_name}
                        </SafeText>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border-subtle bg-surface-card p-3">
                          <div className="text-[11px] uppercase tracking-wide text-text-tertiary">
                            Plan
                          </div>
                          <div className="mt-1 text-sm font-medium text-text-primary">{row.plan}</div>
                        </div>
                        <div className="rounded-2xl border border-border-subtle bg-surface-card p-3">
                          <div className="text-[11px] uppercase tracking-wide text-text-tertiary">
                            Status
                          </div>
                          <div className="mt-1 text-sm font-medium text-text-primary">{row.is_active ? "Active" : "Inactive"}</div>
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
                    <thead className="text-text-tertiary">
                      <tr className="border-b border-border-subtle">
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wide">User ID</th>
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wide">Name</th>
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wide">Email</th>
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wide">Role</th>
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wide">Factory access</th>
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wide">Plan</th>
                        <th className="px-3 py-3 font-medium text-xs uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((row) => (
                        <tr key={row.id} className="border-b border-border-subtle align-top">
                          <td className="px-3 py-3 font-semibold text-text-primary">#{row.user_code}</td>
                          <td className="px-3 py-3 text-text-primary">
                            <SafeText>{row.name}</SafeText>
                          </td>
                          <td className="px-3 py-3 text-text-secondary">
                            <SafeText>{row.email}</SafeText>
                          </td>
                          <td className="px-3 py-3 text-text-primary capitalize">{row.role}</td>
                          <td className="px-3 py-3">
                            <div className="text-text-primary">{row.factory_count === 1 ? "1 factory" : `${row.factory_count} factories`}</div>
                            <SafeText as="div" className="mt-1 text-xs text-text-tertiary">
                              {row.factory_name}
                            </SafeText>
                          </td>
                          <td className="px-3 py-3 text-text-primary">{row.plan}</td>
                          <td className="px-3 py-3 text-text-primary">{row.is_active ? "Active" : "Inactive"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveScrollArea>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-border-subtle bg-surface-panel p-4 text-sm text-text-secondary">
              No users found.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-6">
        <Card className="min-w-0 bg-surface-card border-border-subtle">
          <CardHeader>
            <CardTitle className="text-xl text-text-primary">Invite new user</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            <Field>
              <Label className="text-xs uppercase tracking-wide text-text-secondary">User name</Label>
              <Input
                value={inviteName}
                onChange={(e) => onInviteNameChange(e.target.value)}
                className="bg-surface-panel border-border-subtle text-text-primary focus:border-[color:var(--action-primary)]"
              />
            </Field>
            <Field>
              <Label className="text-xs uppercase tracking-wide text-text-secondary">Email address</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => onInviteEmailChange(e.target.value)}
                className="bg-surface-panel border-border-subtle text-text-primary focus:border-[color:var(--action-primary)]"
              />
            </Field>
            <Field>
              <Label className="text-xs uppercase tracking-wide text-text-secondary">System role</Label>
              <Select
                value={inviteRole}
                onChange={(e) => onInviteRoleChange(e.target.value)}
                className="bg-surface-panel border-border-subtle text-text-primary focus:border-[color:var(--action-primary)]"
              >
                {assignableRoles.map((role) => (
                  <option key={role} value={role} className="capitalize">
                    {role}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              onClick={onInviteUser}
              disabled={busy}
              className="w-full sm:w-auto"
            >
              Generate invitation
            </Button>
          </CardContent>
        </Card>

        <Card className="min-w-0 bg-surface-card border-border-subtle">
          <CardHeader>
            <CardTitle className="text-xl text-text-primary">Factory access</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            {canManageFactoryAccess ? (
              <>
                <Field>
                  <Label className="text-xs uppercase tracking-wide text-text-secondary">Select user</Label>
                  <Select
                    value={accessUserId}
                    onChange={(e) => onAccessUserIdChange(e.target.value)}
                    className="bg-surface-panel border-border-subtle text-text-primary focus:border-[color:var(--action-primary)]"
                  >
                    <option value="">Select user</option>
                    {users.map((managedUser) => (
                      <option key={managedUser.id} value={managedUser.id}>
                        #{managedUser.user_code} {managedUser.name} - {managedUser.role}
                      </option>
                    ))}
                  </Select>
                </Field>
                {accessLoading ? (
                  <div className="rounded-2xl border border-border-subtle bg-surface-panel p-4 text-sm text-text-secondary">
                    Loading access data...
                  </div>
                ) : accessSnapshot ? (
                  <>
                    <div className="min-w-0 rounded-2xl border border-border-subtle bg-surface-panel p-4">
                      <SafeText as="div" className="text-sm font-semibold text-text-primary">
                        {accessSnapshot.user.name}
                      </SafeText>
                      <div className="mt-1 overflow-safe-text text-xs text-text-secondary">
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
                            className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-panel p-4 sm:flex-row sm:items-start sm:justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <SafeText as="div" className="text-sm font-semibold text-text-primary">
                                {factoryOption.name}
                              </SafeText>
                              <div className="mt-1 overflow-safe-text text-xs text-text-secondary">
                                {factoryOption.industry_label} - Members: {factoryOption.member_count}
                                {factoryOption.is_primary ? " - Primary node" : ""}
                              </div>
                              {factoryOption.location ? (
                                <SafeText as="div" className="mt-1 text-xs text-text-tertiary">
                                  {factoryOption.location}
                                </SafeText>
                              ) : null}
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggleAccessFactory(factoryOption.factory_id)}
                              className="mt-1 h-4 w-4 shrink-0 accent-[var(--action-primary)]"
                            />
                          </label>
                        );
                      })}
                    </div>
                    <div className="overflow-safe-text text-xs text-text-tertiary">
                      Owners and admins can place one user across multiple factories. At least one factory must stay
                      selected.
                    </div>
                    <Button
                      onClick={onSaveFactoryAccess}
                      disabled={busy || !accessSnapshot || !accessFactoryIds.length}
                      className="w-full sm:w-auto"
                    >
                      Save factory access
                    </Button>
                  </>
                ) : (
                  <div className="rounded-2xl border border-border-subtle bg-surface-panel p-4 text-sm text-text-secondary">
                    Choose a user to manage factory membership.
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-border-subtle bg-surface-panel p-4 text-sm text-text-secondary">
                Multi-factory access is managed by admins and owners.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-xl">Update role / deactivate</CardTitle>
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
