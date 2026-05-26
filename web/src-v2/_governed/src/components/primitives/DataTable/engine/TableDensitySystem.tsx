import type { TableDensitySystemProps } from "../../../../../types/datatable";
import { useDataTableEngine } from "./hooks";

export function TableDensitySystem({ children }: TableDensitySystemProps) {
  const { density, setDensity } = useDataTableEngine();

  return <>{typeof children === "function" ? children({ density, setDensity }) : children}</>;
}
