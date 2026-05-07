type KeyboardShortcutStripProps = {
  lowConfidenceCount: number;
  totalCells: number;
  editedCount?: number;
};

export function KeyboardShortcutStrip({ lowConfidenceCount, totalCells, editedCount = 0 }: KeyboardShortcutStripProps) {
  const verifiedCount = totalCells - lowConfidenceCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#e3e8ef] bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-4 text-xs font-medium">
        {verifiedCount > 0 && (
          <span className="text-green-700">
            ✓ {verifiedCount} verified
          </span>
        )}
        {lowConfidenceCount > 0 && (
          <span className="text-amber-700">
            ⚠ {lowConfidenceCount} need review
          </span>
        )}
        {editedCount > 0 && (
          <span className="text-blue-700">
            ✎ {editedCount} edited
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-[#667085]">
        <span className="font-mono">Enter</span>
        <span className="font-mono">Esc</span>
        <span className="font-mono">Tab</span>
        <span className="font-mono">Ctrl+Z</span>
        <span className="font-mono">Ctrl+S</span>
      </div>
    </div>
  );
}
