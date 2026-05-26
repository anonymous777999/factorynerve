import type { Density, ToolbarProps } from "../../../types/datatable";
import { cx } from "../../../lib/utils";
import { getInteractionAttributes } from "../primitives/Interaction";
import { Tooltip } from "../primitives/Tooltip";
import {
  Toolbar,
  ToolbarActions,
  ToolbarCommandRegion,
  ToolbarDivider,
  ToolbarFilters,
  ToolbarSection,
  ToolbarViewControls,
  TOOLBAR_AI_BUTTON_CLASSNAME,
} from "../primitives/Toolbar";

const DENSITY_LABELS: Record<Density, string> = {
  compact: "Compact",
  default: "Default",
  touch: "Touch",
};

function AISparkle() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M6.5 1L7.9 5.4H12L8.5 7.9L9.9 12.3L6.5 9.8L3.1 12.3L4.5 7.9L1 5.4H5.1L6.5 1Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function DataTableToolbar({
  searchSlot,
  filterSlot,
  actionSlot,
  viewControlSlot,
  density = "default",
  onDensityChange,
  aiPanelOpen,
  onAIPanelToggle,
  className,
}: ToolbarProps) {
  const aiToggleButton = onAIPanelToggle ? (
    <Tooltip content={aiPanelOpen ? "Collapse AI operational panel" : "Open AI operational panel"}>
      <button
        type="button"
        onClick={onAIPanelToggle}
        aria-label={aiPanelOpen ? "Close AI copilot panel" : "Open AI copilot panel"}
        aria-pressed={aiPanelOpen}
        {...getInteractionAttributes({ aiActive: aiPanelOpen, hover: true, selected: aiPanelOpen })}
        className={cx(
          TOOLBAR_AI_BUTTON_CLASSNAME,
          aiPanelOpen &&
            "border-[var(--prim-blue-700)] bg-[var(--color-accent-ai-surface,var(--prim-blue-950))] text-[var(--prim-blue-300)]"
        )}
      >
        <AISparkle />
        <span>AI</span>
      </button>
    </Tooltip>
  ) : null;

  return (
    <Toolbar aria-label="Table controls" className={className}>
      <ToolbarSection overflow="clip">
        {searchSlot ? <div className="min-w-[200px] max-w-[320px] shrink-0">{searchSlot}</div> : null}
      </ToolbarSection>

      <ToolbarSection grow overflow="clip">
        <ToolbarFilters className="min-w-0" activeFilters={[]} >
          {filterSlot}
        </ToolbarFilters>
      </ToolbarSection>

      <ToolbarSection align="end">
        <ToolbarViewControls
          density={density}
          densityLabel={DENSITY_LABELS[density]}
          onDensityChange={onDensityChange}
        >
          {viewControlSlot}
        </ToolbarViewControls>
      </ToolbarSection>

      {aiToggleButton || actionSlot ? <ToolbarDivider /> : null}

      {aiToggleButton ? (
        <ToolbarCommandRegion emphasize="ai">
          {aiToggleButton}
        </ToolbarCommandRegion>
      ) : null}

      {actionSlot ? (
        <ToolbarActions>
          <div className="flex shrink-0 items-center gap-[var(--spacing-1)]">{actionSlot}</div>
        </ToolbarActions>
      ) : null}
    </Toolbar>
  );
}
