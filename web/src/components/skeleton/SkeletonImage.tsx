export function SkeletonImage({
  className = "",
  height = "h-48",
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