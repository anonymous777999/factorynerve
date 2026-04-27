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
          ? "border-[#185FA5] bg-[#185FA5] text-white"
          : "border-[#d9e1e8] bg-white text-[#344054] hover:border-[#185FA5]/35 hover:text-[#185FA5]",
      )}
    >
      {label}
    </button>
  );
}

export function EditToolbar(props: EditToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[24px] border border-[#e3e8ef] bg-white p-3">
      <ToolbarButton label="+ Row" onClick={props.onAddRow} />
      <ToolbarButton label="+ Col" onClick={props.onAddColumn} />
      <ToolbarButton label="Undo" onClick={props.onUndo} disabled={!props.canUndo} />
      <ToolbarButton label="Redo" onClick={props.onRedo} disabled={!props.canRedo} />
      <ToolbarButton
        label="Header row"
        onClick={props.onToggleHeaderRow}
        active={props.headerRowEnabled}
      />
      <ToolbarButton
        label="Low confidence"
        onClick={props.onToggleConfidence}
        active={props.showLowConfidence}
      />
    </div>
  );
}
