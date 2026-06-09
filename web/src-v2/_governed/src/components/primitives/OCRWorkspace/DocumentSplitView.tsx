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
      <WorkspaceLayoutRegion className="min-w-[360px] flex-[0_1_46%]">{documentSlot}</WorkspaceLayoutRegion>
      <WorkspaceLayoutRegion className="min-w-[520px] flex-[1_1_54%] border-l border-[var(--color-border-default)]">
        {reviewSlot}
      </WorkspaceLayoutRegion>
    </WorkspaceLayoutRegion>
  );
}
