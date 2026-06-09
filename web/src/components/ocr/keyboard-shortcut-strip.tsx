type KeyboardShortcutStripProps = {
  lowConfidenceCount: number;
  totalCells: number;
  editedCount?: number;
};

export function KeyboardShortcutStrip({ lowConfidenceCount, totalCells, editedCount = 0 }: KeyboardShortcutStripProps) {
  const verifiedCount = totalCells - lowConfidenceCount;

  return (
    <div className="factory-ocr-shortcuts">
      <div className="flex items-center gap-4 text-xs font-medium">
        {verifiedCount > 0 && (
          <span className="text-[var(--status-success-fg,#9ef0ae)]">
            Verified {verifiedCount}
          </span>
        )}
        {lowConfidenceCount > 0 && (
          <span className="text-[var(--action-primary)]">
            Review {lowConfidenceCount}
          </span>
        )}
        {editedCount > 0 && (
          <span className="text-text-secondary">
            Corrected {editedCount}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
        <span>Enter</span>
        <span>Esc</span>
        <span>Tab</span>
        <span>Ctrl+Z</span>
        <span>Ctrl+S</span>
      </div>
    </div>
  );
}
