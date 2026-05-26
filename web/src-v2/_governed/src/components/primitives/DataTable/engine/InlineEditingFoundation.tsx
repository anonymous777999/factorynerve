import type { InlineEditingFoundationProps } from "../../../../../types/datatable";
import { useDataTableEngine } from "./hooks";

export function InlineEditingFoundation({ children }: InlineEditingFoundationProps) {
  const { editingSession, setEditingSession } = useDataTableEngine();

  const api = {
    cancel: () => setEditingSession(null),
    editingSession,
    startEditing: setEditingSession,
  };

  return <>{typeof children === "function" ? children(api) : children}</>;
}
