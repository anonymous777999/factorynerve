import { SkeletonText } from "./SkeletonText";

export function SkeletonTableRow({
  columns = 7,
  className = "",
}: {
  columns?: number;
  className?: string;
}) {
  const cells = Array.from({ length: columns }, (_, i) => (
    <SkeletonText
      key={i}
      className="w-32 md:w-40"
    />
  ));
  return (
    <tr className="border-b" aria-hidden="true">
      {cells}
    </tr>
  );
}