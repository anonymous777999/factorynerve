import { Button } from "@/components/ui/button";

type OCRUploaderProps = {
  onPick: (file: File | null) => void;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  galleryInputRef: React.RefObject<HTMLInputElement | null>;
};

export function OCRUploader({ onPick, cameraInputRef, galleryInputRef }: OCRUploaderProps) {
  return (
    <div className="space-y-4">
      <Button
        className="h-16 w-full justify-start rounded-2xl px-5 text-base font-semibold"
        onClick={() => cameraInputRef.current?.click()}
      >
        Scan Document
      </Button>
      <Button
        variant="outline"
        className="h-16 w-full justify-start rounded-2xl px-5 text-base font-semibold"
        onClick={() => galleryInputRef.current?.click()}
      >
        Upload From Gallery
      </Button>
      <input
        ref={cameraInputRef}
        className="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
      <input
        ref={galleryInputRef}
        className="hidden"
        type="file"
        accept="image/*"
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 text-xs text-[var(--muted)]">
        Keep the document flat, fill most of the frame, and avoid glare.
      </div>
    </div>
  );
}

