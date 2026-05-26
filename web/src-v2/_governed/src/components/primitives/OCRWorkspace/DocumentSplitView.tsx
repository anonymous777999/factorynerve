import { cx } from "../../../../lib/utils";
import type { DocumentSplitViewProps } from "../../../../types/datatable";
import { WorkspaceLayoutRegion } from "../Viewport";
import { useOCRWorkspace } from "./hooks";

export function DocumentSplitView({ documentSlot, reviewSlot, className, ...props }: DocumentSplitViewProps) {
  const { splitMode } = useOCRWorkspace();

  if (splitMode === "document") {
    return <div className={cx("flex h-full min-h-0 flex-col", className)} {...props}>{documentSlot}</div>;
  }

  if (splitMode === "review") {
    return <div className={cx("flex h-full min-h-0 flex-col", className)} {...props}>{reviewSlot}</div>;
  }

  return (
    <WorkspaceLayoutRegion direction="horizontal" grow className={cx("min-h-0", className)} {...props}>
      <WorkspaceLayoutRegion grow>{documentSlot}</WorkspaceLayoutRegion>
      <WorkspaceLayoutRegion className="w-[360px] min-w-[320px] max-w-[420px] shrink-0 border-l border-[var(--color-border-default)]">
        {reviewSlot}
      </WorkspaceLayoutRegion>
    </WorkspaceLayoutRegion>
  );
}
