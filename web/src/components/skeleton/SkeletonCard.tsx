import { SkeletonAvatar } from "./SkeletonAvatar";
import { SkeletonText } from "./SkeletonText";

export function SkeletonCard({
  className = "",
  children,
}: { className?: string; children?: React.ReactNode } = {}) {
  return (
    <div className={`
      rounded-[1.4rem] border border-[var(--border)] bg-[var(--card)]
      p-4 space-y-4 ${className}
    `} aria-hidden="true">
      {children ? children : (
        <>
          <div className="flex items-center space-x-3">
            <SkeletonAvatar className="h-10 w-10" />
            <div className="space-y-1">
              <SkeletonText className="w-32" />
              <SkeletonText className="w-24" />
            </div>
          </div>
          <SkeletonText className="w-48" />
          <SkeletonText className="w-64" />
        </>
      )}
    </div>
  );
}
