import { Button } from "@/components/ui/button";

type OCRErrorProps = {
  message: string;
  onRetry: () => void;
  onEditImage: () => void;
  onManualEntry?: () => void;
};

export function OCRError({ message, onRetry, onEditImage, onManualEntry }: OCRErrorProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-red-500/30 bg-[rgba(239,68,68,0.08)] p-4 text-red-200">
      <div className="text-sm font-semibold">Image unclear. Try better lighting.</div>
      <div className="text-sm text-red-300">{message}</div>
      <div className="flex flex-wrap gap-2">
        <Button className="h-10" variant="outline" onClick={onRetry}>
          Retry
        </Button>
        <Button className="h-10" variant="ghost" onClick={onEditImage}>
          Edit Image
        </Button>
        {onManualEntry ? (
          <Button className="h-10" variant="ghost" onClick={onManualEntry}>
            Continue Manual
          </Button>
        ) : null}
      </div>
    </div>
  );
}
