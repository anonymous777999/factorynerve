import { cn } from "@/lib/utils";

export function SkeletonText({
  className = "",
  ...rest
}: React.ComponentProps<"span">) {
  return (
    <span
      className={`
        h-4 w-32 rounded animate-pulse bg-gray-200
        ${className}
      `}
      aria-hidden="true"
      {...rest}
    />
  );
}