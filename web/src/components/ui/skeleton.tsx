import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl bg-[linear-gradient(90deg,rgba(37,45,64,0.85),rgba(62,166,255,0.16),rgba(37,45,64,0.85))] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}
