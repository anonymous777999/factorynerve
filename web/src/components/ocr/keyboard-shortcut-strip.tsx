type KeyboardShortcutStripProps = {
  lowConfidenceCount: number;
};

export function KeyboardShortcutStrip({ lowConfidenceCount }: KeyboardShortcutStripProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#e3e8ef] bg-[#fbfcfd] px-4 py-3 text-xs text-[#667085]">
      <div>{lowConfidenceCount} low-confidence cells</div>
      <div className="flex flex-wrap items-center gap-3">
        <span>F2 edit</span>
        <span>Tab move</span>
        <span>Esc cancel</span>
        <span>Ctrl+Z undo</span>
        <span>Ctrl+Y redo</span>
      </div>
    </div>
  );
}
