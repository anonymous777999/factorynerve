export function SkeletonAvatar({
  className = "",
}: { className?: string } = {}) {
  return (
    <div
      className={`
        h-12 w-12 rounded-full animate-pulse bg-gray-200
        ${className}
      `}
      aria-hidden="true"
    />
  );
}