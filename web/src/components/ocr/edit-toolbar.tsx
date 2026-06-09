import { cn } from "@/lib/utils";

type EditToolbarProps = {
  canUndo: boolean;
  canRedo: boolean;
  headerRowEnabled: boolean;
  showLowConfidence: boolean;
  onAddRow: () => void;
  onAddColumn: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleHeaderRow: () => void;
  onToggleConfidence: () => void;
};

function ToolbarButton({
  label,
  onClick,
  disabled,
  active = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-10 rounded-full border px-4 text-sm font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-45",
        active
          ? "border-accent bg-accent text-white"
          : "border-border-subtle bg-white text-text-primary hover:border-accent/35 hover:text-accent",
      )}
    >
      {label}
    </button>
  );
}

export function EditToolbar(props: EditToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[20px] border border-border-subtle bg-white px-3 py-2.5 shadow-sm">
      <ToolbarButton label="+ Row" onClick={props.onAddRow} />
      <ToolbarButton label="+ Col" onClick={props.onAddColumn} />
      <ToolbarButton label="Undo" onClick={props.onUndo} disabled={!props.canUndo} />
      <ToolbarButton label="Redo" onClick={props.onRedo} disabled={!props.canRedo} />
      <ToolbarButton
        label="Header row"
        onClick={props.onToggleHeaderRow}
        active={props.headerRowEnabled}
      />
    </div>
  );
}
