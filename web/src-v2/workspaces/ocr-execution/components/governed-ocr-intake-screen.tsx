"use client";

import Link from "next/link";

import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
  WorkspaceViewport,
} from "@/v2/_governed";

type GovernedOcrIntakeScreenProps = {
  busy: boolean;
  columns: number;
  error?: string;
  language: string;
  legacyHref: string;
  onColumnsChange: (value: number) => void;
  onCreateDraft: () => void | Promise<void>;
  onFileChange: (file: File | null) => void;
  onLanguageChange: (value: string) => void;
  onOpenQueue: () => void;
  onSelectedTemplateChange: (value: string) => void;
  previewLanguages: readonly string[];
  selectedTemplateId: string;
  status?: string;
  templateOptions: Array<{ id: number; name: string }>;
};

const fieldClassName =
  "mt-[var(--spacing-2)] w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] px-[var(--spacing-3)] py-[var(--spacing-3)] text-[14px] text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent-operational-border)] focus:ring-2 focus:ring-[var(--color-accent-operational-border)]/30";

export function GovernedOcrIntakeScreen({
  busy,
  columns,
  error,
  language,
  legacyHref,
  onColumnsChange,
  onCreateDraft,
  onFileChange,
  onLanguageChange,
  onOpenQueue,
  onSelectedTemplateChange,
  previewLanguages,
  selectedTemplateId,
  status,
  templateOptions,
}: GovernedOcrIntakeScreenProps) {
  return (
    <main className="dpr-governed-ocr factory-ocr-scope min-h-screen px-4 py-4 md:px-6 md:py-5">
      {error ? (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
      ) : null}
      {status ? (
        <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{status}</div>
      ) : null}
      <div className="border-b border-white/10 bg-black/20 px-4 py-3 text-xs uppercase tracking-[0.16em] text-white/60">
        Governed intake stays rollback-safe.{" "}
        <Link href={legacyHref} className="text-amber-300 underline underline-offset-4">
          Open legacy intake lane
        </Link>
      </div>
      <div className="factory-ocr-shell">
        <section className="factory-ocr-header">
          <div className="factory-ocr-header__meta">
            <div className="max-w-4xl">
              <div className="factory-ocr-header__eyebrow">Governed OCR Intake</div>
              <h1 className="factory-ocr-header__title">Create route-owned verification draft</h1>
              <p className="factory-ocr-header__subtitle">
                This intake lane feeds the governed OCR queue directly so the same operator can move from upload into correction without losing context.
              </p>
            </div>
            <div className="factory-ocr-telemetry">
              <div className="factory-ocr-telemetry__item">
                <div className="factory-ocr-telemetry__label">Templates</div>
                <div className="factory-ocr-telemetry__value">{templateOptions.length} available</div>
              </div>
              <div className="factory-ocr-telemetry__item">
                <div className="factory-ocr-telemetry__label">Language hint</div>
                <div className="factory-ocr-telemetry__value">{language}</div>
              </div>
              <div className="factory-ocr-telemetry__item">
                <div className="factory-ocr-telemetry__label">Expected columns</div>
                <div className="factory-ocr-telemetry__value">{columns}</div>
              </div>
            </div>
          </div>
          <div className="factory-ocr-stagebar">
            <div className="factory-ocr-stagepill" data-state="done"><span className="factory-ocr-stagepill__index">1</span><span className="factory-ocr-stagepill__label">Upload</span></div>
            <div className="factory-ocr-stagepill" data-state="current"><span className="factory-ocr-stagepill__index">2</span><span className="factory-ocr-stagepill__label">Prepare</span></div>
            <div className="factory-ocr-stagepill" data-state="idle"><span className="factory-ocr-stagepill__index">3</span><span className="factory-ocr-stagepill__label">Review</span></div>
            <div className="factory-ocr-stagepill" data-state="idle"><span className="factory-ocr-stagepill__index">4</span><span className="factory-ocr-stagepill__label">Export</span></div>
          </div>
        </section>

        <WorkspaceViewport surface="canvas" className="min-h-[72vh]">
        <div className="mx-auto flex w-full max-w-6xl items-center py-4">
          <Panel variant="workspace" padding="none" className="w-full overflow-hidden">
            <PanelHeader
              title="Governed OCR intake"
              subtitle="Create a route-owned verification draft without leaving the governed workflow boundary"
              meta="Step 2"
            />
            <PanelBody className="grid gap-[var(--spacing-4)] p-[var(--spacing-5)] lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-[var(--spacing-4)]">
                <PanelSection inset title="Document intake" description="Create a real OCR verification draft against the production API and hand it directly into the governed review queue.">
                  <label className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    Document image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className={fieldClassName}
                    onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                  />
                </PanelSection>

                <PanelSection inset title="Reading guide" description="Choose the backend template and OCR reading hint that should shape the initial extraction draft.">
                  <div className="grid gap-[var(--spacing-4)] md:grid-cols-2">
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                        Template
                      </label>
                      <select
                        className={fieldClassName}
                        value={selectedTemplateId}
                        onChange={(event) => onSelectedTemplateChange(event.target.value)}
                      >
                        <option value="">No template</option>
                        {templateOptions.map((template) => (
                          <option key={template.id} value={String(template.id)}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                        Language hint
                      </label>
                      <select className={fieldClassName} value={language} onChange={(event) => onLanguageChange(event.target.value)}>
                        {previewLanguages.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-[var(--spacing-4)] max-w-[220px]">
                    <label className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                      Expected columns
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      className={fieldClassName}
                      value={columns}
                      onChange={(event) => onColumnsChange(Math.max(1, Number(event.target.value) || 1))}
                    />
                  </div>
                </PanelSection>
              </div>

              <div className="space-y-[var(--spacing-4)]">
                <PanelSection inset title="Operational controls" description="Create the draft, then move straight into governed correction and approval.">
                  <div className="flex flex-col gap-[var(--spacing-2)]">
                    <button type="button" className="fn-btn fn-btn-primary" onClick={() => void onCreateDraft()} disabled={busy}>
                      {busy ? "Creating draft..." : "Create governed draft"}
                    </button>
                    <button type="button" className="fn-btn fn-btn-secondary" onClick={onOpenQueue}>
                      Back to queue
                    </button>
                    <Link href={legacyHref} className="fn-btn fn-btn-secondary text-center">
                      Legacy rollback lane
                    </Link>
                  </div>
                </PanelSection>

                <PanelSection inset title="Transfer target" description="This intake feeds the governed OCR workspace, not the legacy correction surface.">
                  <div className="space-y-[var(--spacing-2)] text-[13px] text-[var(--color-text-secondary)]">
                    <div>Real backend APIs remain untouched.</div>
                    <div>Draft state becomes route-owned as soon as the verification record is created.</div>
                    <div>Rollback remains available until the governed lane proves stable under production use.</div>
                  </div>
                </PanelSection>
              </div>
            </PanelBody>
          </Panel>
        </div>
        </WorkspaceViewport>
      </div>
    </main>
  );
}
