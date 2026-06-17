"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type {
  BillingStatus,
  ControlTowerPayload,
  FactoryProfileOption,
  FactorySettings,
  FactorySummary,
  FactoryTemplatesPayload,
} from "@/lib/settings";

type NewFactoryFormState = {
  name: string;
  location: string;
  address: string;
  timezone: string;
  industry_type: string;
  workflow_template_key: string;
};

type TemplateOption =
  | FactoryTemplatesPayload["templates"][number]
  | FactoryTemplatesPayload["active_template"]
  | null;

type SettingsFactoryTabProps = {
  busy: boolean;
  billing: BillingStatus | null;
  controlTower: ControlTowerPayload | null;
  factory: FactorySettings;
  factoryDirectory: FactorySummary[];
  factoryTemplates: FactoryTemplatesPayload | null;
  profiles: FactoryProfileOption[];
  currentIndustryProfile: FactoryProfileOption | null;
  selectedFactoryTemplate: TemplateOption;
  newFactoryForm: NewFactoryFormState;
  newFactoryTemplates: FactoryTemplatesPayload | null;
  selectedNewFactoryTemplate: TemplateOption;
  onFactoryChange: (updater: (prev: FactorySettings) => FactorySettings) => void;
  onNewFactoryFormChange: (updater: (prev: NewFactoryFormState) => NewFactoryFormState) => void;
  onSaveFactoryProfile: () => void;
  onCreateFactory: () => void;
  coerceIntegerInput: (value: string, minValue: number) => number;
};

export function SettingsFactoryTab({
  busy,
  billing,
  controlTower,
  factory,
  factoryDirectory,
  factoryTemplates,
  profiles,
  currentIndustryProfile,
  selectedFactoryTemplate,
  newFactoryForm,
  newFactoryTemplates,
  selectedNewFactoryTemplate,
  onFactoryChange,
  onNewFactoryFormChange,
  onSaveFactoryProfile,
  onCreateFactory,
  coerceIntegerInput,
}: SettingsFactoryTabProps) {
  const profileOptions =
    profiles.length > 0
      ? profiles
      : [{ key: "general", label: "General Manufacturing", description: "", starter_modules: [] }];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Factory Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-[var(--muted)]">Factory Name</label>
            <Input
              value={factory.factory_name}
              onChange={(e) => onFactoryChange((prev) => ({ ...prev, factory_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-[var(--muted)]">Industry Profile</label>
            <Select
              value={factory.industry_type}
              onChange={(e) => {
                const nextProfile = profiles.find((profile) => profile.key === e.target.value);
                onFactoryChange((prev) => ({
                  ...prev,
                  industry_type: e.target.value,
                  industry_label: nextProfile?.label || prev.industry_label,
                  factory_type: nextProfile?.label || prev.factory_type,
                  starter_modules: nextProfile?.starter_modules || prev.starter_modules,
                }));
              }}
            >
              {profileOptions.map((profile) => (
                <option key={profile.key} value={profile.key}>
                  {profile.label}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {currentIndustryProfile?.description || "Choose the safest baseline industry workflow for this factory."}
            </p>
          </div>
          <div>
            <label className="text-sm text-[var(--muted)]">Workflow Template</label>
            <Select
              value={factory.workflow_template_key}
              onChange={(e) => {
                const nextTemplate = factoryTemplates?.templates.find((item) => item.key === e.target.value);
                onFactoryChange((prev) => ({
                  ...prev,
                  workflow_template_key: e.target.value,
                  workflow_template_label: nextTemplate?.label || prev.workflow_template_label,
                }));
              }}
            >
              {(factoryTemplates?.templates || []).map((template) => (
                <option key={template.key} value={template.key}>
                  {template.label}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {selectedFactoryTemplate?.description ||
                "Choose the operating template that becomes the default starter pack for this factory."}
            </p>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-[var(--muted)]">Address</label>
            <Input
              value={factory.address}
              onChange={(e) => onFactoryChange((prev) => ({ ...prev, address: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
            <div className="text-sm font-semibold">Starter Modules</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(selectedFactoryTemplate?.modules || factory.starter_modules || []).map((module) => (
                <span
                  key={module}
                  className="rounded-full border border-[rgba(62,166,255,0.24)] bg-[rgba(62,166,255,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]"
                >
                  {module.replace(/_/g, " ")}
                </span>
              ))}
            </div>
            {selectedFactoryTemplate?.sections?.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {selectedFactoryTemplate.sections.map((section) => (
                  <div key={section.key} className="rounded-2xl border border-[var(--border)]/70 bg-[rgba(8,12,20,0.55)] p-4">
                    <div className="text-sm font-semibold">{section.label}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--muted)]">{section.description}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {section.fields.map((field) => (
                        <span
                          key={field.key}
                          className="rounded-full border border-[var(--border)] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]"
                        >
                          {field.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <label className="text-sm text-[var(--muted)]">Morning Target</label>
            <Input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={factory.target_morning}
              onChange={(e) =>
                onFactoryChange((prev) => ({
                  ...prev,
                  target_morning: coerceIntegerInput(e.target.value, 0),
                }))
              }
            />
          </div>
          <div>
            <label className="text-sm text-[var(--muted)]">Evening Target</label>
            <Input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={factory.target_evening}
              onChange={(e) =>
                onFactoryChange((prev) => ({
                  ...prev,
                  target_evening: coerceIntegerInput(e.target.value, 0),
                }))
              }
            />
          </div>
          <div>
            <label className="text-sm text-[var(--muted)]">Night Target</label>
            <Input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={factory.target_night}
              onChange={(e) =>
                onFactoryChange((prev) => ({
                  ...prev,
                  target_night: coerceIntegerInput(e.target.value, 0),
                }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={onSaveFactoryProfile} disabled={busy}>
              Save Factory Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Create Factory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-[var(--muted)]">Factory Name</label>
              <Input
                value={newFactoryForm.name}
                onChange={(e) => onNewFactoryFormChange((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Industry Profile</label>
              <Select
                value={newFactoryForm.industry_type}
                onChange={(e) =>
                  onNewFactoryFormChange((prev) => ({ ...prev, industry_type: e.target.value }))
                }
              >
                {profileOptions.map((profile) => (
                  <option key={profile.key} value={profile.key}>
                    {profile.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Workflow Template</label>
              <Select
                value={newFactoryForm.workflow_template_key}
                onChange={(e) =>
                  onNewFactoryFormChange((prev) => ({
                    ...prev,
                    workflow_template_key: e.target.value,
                  }))
                }
              >
                {(newFactoryTemplates?.industry_type === newFactoryForm.industry_type
                  ? newFactoryTemplates.templates
                  : []
                ).map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.label}
                  </option>
                ))}
              </Select>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {selectedNewFactoryTemplate?.description ||
                  "Choose the starter workflow your team should see on day one."}
              </p>
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Location</label>
              <Input
                value={newFactoryForm.location}
                onChange={(e) => onNewFactoryFormChange((prev) => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Address</label>
              <Input
                value={newFactoryForm.address}
                onChange={(e) => onNewFactoryFormChange((prev) => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
              <div className="text-sm font-semibold">Pack Preview</div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Shared industrial modules that will be enabled first for this factory.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(selectedNewFactoryTemplate?.modules || newFactoryTemplates?.starter_modules || []).map((module) => (
                  <span
                    key={module}
                    className="rounded-full border border-[rgba(62,166,255,0.24)] bg-[rgba(62,166,255,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]"
                  >
                    {module.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
            <Button onClick={onCreateFactory} disabled={busy || !newFactoryForm.name.trim()}>
              Create Factory
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Control Tower Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">
              Org: {controlTower?.organization.name || factory.factory_name || "Current organization"} | Plan{" "}
              {controlTower?.organization.plan || billing?.plan || "-"}
            </div>
            {factoryDirectory.length ? (
              <div className="space-y-3">
                {factoryDirectory.map((item) => (
                  <div key={item.factory_id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{item.name}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          {item.industry_label} | {item.workflow_template_label}
                        </div>
                      </div>
                      {item.is_active_context ? (
                        <span className="rounded-full border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                          Active
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 text-xs text-[var(--muted)]">
                      Code {item.factory_code || "-"} | Members {item.member_count} | Role {item.my_role || "-"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                No additional factories yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
