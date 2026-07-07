export function SkeletonRect({
  className = "",
  height = "h-16",
  width = "w-full",
}: { className?: string; height?: string; width?: string } = {}) {
  return (
    <div
      className={`
        ${height} ${width} rounded animate-pulse bg-gray-200
        ${className}
      `}
      aria-hidden="true"
    />
  );
}