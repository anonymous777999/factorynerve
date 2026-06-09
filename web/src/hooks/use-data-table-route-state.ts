"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  ColumnFiltersState,
  SortingState,
} from "@tanstack/react-table";

import type { DataTableQueryState } from "@/components/ui/data-table/data-table-types";
import {
  buildDataTableQueryParams,
  normalizeDataTableQueryState,
  parseDataTableQueryState,
} from "@/lib/data-table-query";

type UseDataTableRouteStateOptions = {
  debounceMs?: number;
  defaultColumnFilters?: ColumnFiltersState;
  defaultSearch?: string;
  defaultSorting?: SortingState;
  filterIds?: string[];
  filterPrefix?: string;
  searchParam?: string;
  sortParam?: string;
};

type RoutePatch = Partial<DataTableQueryState>;

export function useDataTableRouteState(options: UseDataTableRouteStateOptions = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const state = useMemo(
    () => parseDataTableQueryState(searchParams, options),
    [options, searchParams],
  );
  const searchTimeoutRef = useRef<number | null>(null);

  const navigate = useCallback(
    (patch: RoutePatch, history: "push" | "replace" = "replace") => {
      const nextState = normalizeDataTableQueryState({
        columnFilters: patch.columnFilters ?? state.columnFilters,
        search: patch.search ?? state.search,
        sorting: patch.sorting ?? state.sorting,
      });
      const nextParams = buildDataTableQueryParams(nextState, options, searchParams);
      const query = nextParams.toString();
      const href = query ? `${pathname}?${query}` : pathname;

      startTransition(() => {
        if (history === "push") {
          router.push(href, { scroll: false });
          return;
        }

        router.replace(href, { scroll: false });
      });
    },
    [options, pathname, router, searchParams, state.columnFilters, state.search, state.sorting],
  );

  useEffect(
    () => () => {
      if (searchTimeoutRef.current != null) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    },
    [],
  );

  const setColumnFilter = useCallback(
    (id: string, value: string) => {
      const nextFilters = state.columnFilters.filter((filter) => filter.id !== id);
      const normalizedValue = value.trim();
      if (normalizedValue) {
        nextFilters.push({
          id,
          value: normalizedValue,
        });
      }

      navigate({ columnFilters: nextFilters }, "replace");
    },
    [navigate, state.columnFilters],
  );

  const setSorting = useCallback(
    (sorting: SortingState) => {
      navigate({ sorting: sorting.slice(0, 1) }, "replace");
    },
    [navigate],
  );

  const setSearch = useCallback(
    (search: string) => {
      if (searchTimeoutRef.current != null) {
        window.clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = window.setTimeout(() => {
        navigate({ search: search.trim() }, "replace");
      }, options.debounceMs ?? 300);
    },
    [navigate, options.debounceMs],
  );

  return {
    columnFilters: state.columnFilters,
    queryState: state,
    search: state.search,
    setColumnFilter,
    setSearch,
    setSorting,
    sorting: state.sorting,
    clearAll() {
      if (searchTimeoutRef.current != null) {
        window.clearTimeout(searchTimeoutRef.current);
      }
      navigate({
        columnFilters: [],
        search: "",
        sorting: options.defaultSorting ?? [],
      });
    },
  };
}
