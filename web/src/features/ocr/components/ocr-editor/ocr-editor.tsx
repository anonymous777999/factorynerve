import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EnhanceSettings } from "@/lib/image-enhance";

type OCREditorProps = {
  imageUrl: string;
  settings: EnhanceSettings;
  showAfter: boolean;
  busy?: boolean;
  onToggleAutoFix: () => void;
  onToggleBeforeAfter: () => void;
  onRotate: () => void;
  onChangeBrightness: (value: number) => void;
  onChangeContrast: (value: number) => void;
  onToggleCleanup: () => void;
  onCropTighter: () => void;
  onCropReset: () => void;
  onRetry: () => void;
  onBack: () => void;
};

export function OCREditor({
  imageUrl,
  settings,
  showAfter,
  busy,
  onToggleAutoFix,
  onToggleBeforeAfter,
  onRotate,
  onChangeBrightness,
  onChangeContrast,
  onToggleCleanup,
  onCropTighter,
  onCropReset,
  onRetry,
  onBack,
}: OCREditorProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button className="h-10" variant={settings.autoFix ? "primary" : "outline"} onClick={onToggleAutoFix}>
          Auto Fix {settings.autoFix ? "ON" : "OFF"}
        </Button>
        <Button className="h-10" variant="outline" onClick={onToggleBeforeAfter}>
          {showAfter ? "Show Before" : "Show After"}
        </Button>
        <Button className="h-10" variant="outline" onClick={onRotate}>
          Rotate
        </Button>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
        {imageUrl ? (
          <div className="flex h-[58vh] min-h-[340px] max-h-[760px] items-center justify-center overflow-hidden rounded-xl bg-[rgba(6,10,20,0.55)] sm:h-[62vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Edited scan" className="h-full w-full object-contain" />
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
        <label className="text-xs text-[var(--muted)]">
          Brightness ({settings.brightness})
          <Input
            type="range"
            min={-35}
            max={35}
            value={settings.brightness}
            disabled={settings.autoFix}
            onChange={(e) => onChangeBrightness(Number(e.target.value) || 0)}
          />
        </label>
        <label className="mt-2 block text-xs text-[var(--muted)]">
          Contrast ({settings.contrast})
          <Input
            type="range"
            min={-35}
            max={40}
            value={settings.contrast}
            disabled={settings.autoFix}
            onChange={(e) => onChangeContrast(Number(e.target.value) || 0)}
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="h-9" variant={settings.threshold ? "primary" : "outline"} onClick={onToggleCleanup} disabled={settings.autoFix}>
            Background Cleanup {settings.threshold ? "ON" : "OFF"}
          </Button>
          <Button className="h-9" variant="outline" onClick={onCropTighter}>
            Crop Tighter
          </Button>
          <Button className="h-9" variant="ghost" onClick={onCropReset}>
            Reset Crop
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button className="h-12" onClick={onRetry} disabled={busy}>
          {busy ? "Processing..." : "Re-run OCR"}
        </Button>
        <Button className="h-12" variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
