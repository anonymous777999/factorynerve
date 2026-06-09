import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PrepToolbarProps = {
  selectedFilter: "original" | "clean" | "contrast";
  onFilterChange: (value: "original" | "clean" | "contrast") => void;
  onRetake: () => void;
  disabled?: boolean;
};

const FILTERS: Array<{ value: "original" | "clean" | "contrast"; label: string }> = [
  { value: "original", label: "Original" },
  { value: "clean", label: "Clean" },
  { value: "contrast", label: "Contrast" },
];

export function PrepToolbar({
  selectedFilter,
  onFilterChange,
  onRetake,
  disabled = false,
}: PrepToolbarProps) {
  return (
    <div className="space-y-4 rounded-[28px] border border-[#e7eaee] bg-white p-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a93a0]">
          Enhance
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              disabled={disabled}
              onClick={() => onFilterChange(filter.value)}
              className={cn(
                "rounded-[18px] border px-3 py-3 text-sm font-medium transition duration-200",
                selectedFilter === filter.value
                  ? "border-[#111827] bg-surface-app text-white"
                  : "border-[#e5e7eb] bg-surface-shell text-text-secondary hover:border-[#c9d2dd] hover:bg-surface-hover",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[20px] border border-border-subtle bg-surface-shell px-4 py-4 text-sm leading-6 text-text-secondary">
        Crop the page tightly, keep the sheet flat, then run extraction.
      </div>

      <Button
        type="button"
        variant="ghost"
        className="h-11 w-full rounded-[18px] border border-border-subtle bg-surface-shell text-text-secondary hover:bg-surface-hover"
        onClick={onRetake}
      >
        Retake
      </Button>
    </div>
  );
}

