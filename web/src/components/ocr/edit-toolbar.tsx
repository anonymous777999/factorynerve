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
          ? "border-[#8c4218] bg-[#8c4218] text-white"
          : "border-[#d9e1e8] bg-white text-[#344054] hover:border-[#8c4218]/35 hover:text-[#8c4218]",
      )}
    >
      {label}
    </button>
  );
}

export function EditToolbar(props: EditToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[20px] border border-[#e3e8ef] bg-white px-3 py-2.5 shadow-sm">
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
