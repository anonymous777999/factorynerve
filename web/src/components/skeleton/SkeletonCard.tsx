export function SkeletonCard({
  className = "",
}: { className?: string } = {}) {
  return (
    <div className={`
      rounded-[1.4rem] border border-[var(--border)] bg-[var(--card)]
      p-4 space-y-4 ${className}
    `} aria-hidden="true">
      <div className="flex items-center space-x-3">
        <SkeletonAvatar className="h-10 w-10" />
        <div className="space-y-1">
          <SkeletonText className="w-32" />
          <SkeletonText className="w-24" />
        </div>
      </div>
      <SkeletonText className="w-48" />
      <SkeletonText className="w-64" />
    </div>
  );
}