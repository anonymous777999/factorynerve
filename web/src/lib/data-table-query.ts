import type {
  ColumnFiltersState,
  SortingState,
} from "@tanstack/react-table";

import type { DataTableQueryState } from "@/components/ui/data-table/data-table-types";

type DataTableQueryConfig = {
  defaultColumnFilters?: ColumnFiltersState;
  defaultSearch?: string;
  defaultSorting?: SortingState;
  filterIds?: string[];
  filterPrefix?: string;
  searchParam?: string;
  sortParam?: string;
};

const DEFAULT_SEARCH_PARAM = "q";
const DEFAULT_SORT_PARAM = "sort";
const DEFAULT_FILTER_PREFIX = "filter_";

function getConfigValue<TValue>(
  value: TValue | undefined,
  fallback: TValue,
) {
  return value ?? fallback;
}

export function normalizeDataTableQueryState(
  state: DataTableQueryState,
): DataTableQueryState {
  const normalizedFilters = [...state.columnFilters]
    .filter((filter) => typeof filter.id === "string")
    .map((filter) => ({
      id: filter.id,
      value: typeof filter.value === "string" ? filter.value.trim() : filter.value,
    }))
    .filter((filter) => filter.value !== "")
    .sort((left, right) => left.id.localeCompare(right.id));

  const normalizedSorting = state.sorting.slice(0, 1).map((sort) => ({
    id: sort.id,
    desc: Boolean(sort.desc),
  }));

  return {
    columnFilters: normalizedFilters,
    search: state.search.trim(),
    sorting: normalizedSorting,
  };
}

export function parseDataTableQueryState(
  searchParams: URLSearchParams | ReadonlyURLSearchParams,
  config: DataTableQueryConfig = {},
): DataTableQueryState {
  const searchParam = getConfigValue(config.searchParam, DEFAULT_SEARCH_PARAM);
  const sortParam = getConfigValue(config.sortParam, DEFAULT_SORT_PARAM);
  const filterPrefix = getConfigValue(config.filterPrefix, DEFAULT_FILTER_PREFIX);
  const filterIds = config.filterIds ?? [];
  const defaultColumnFilters = config.defaultColumnFilters ?? [];
  const defaultSearch = config.defaultSearch ?? "";
  const defaultSorting = config.defaultSorting ?? [];

  const search = searchParams.get(searchParam)?.trim() ?? defaultSearch;
  const rawSort = searchParams.get(sortParam)?.trim() ?? "";
  const sortParts = rawSort.split(":");
  const sorting =
    sortParts.length === 2 && sortParts[0]
      ? [{ id: sortParts[0], desc: sortParts[1] === "desc" }]
      : defaultSorting.slice(0, 1);

  const seenFilterIds = new Set<string>();
  const parsedFilters: ColumnFiltersState = [];

  filterIds.forEach((filterId) => {
    const rawValue = searchParams.get(`${filterPrefix}${filterId}`)?.trim() ?? "";
    if (!rawValue) {
      return;
    }

    seenFilterIds.add(filterId);
    parsedFilters.push({
      id: filterId,
      value: rawValue,
    });
  });

  searchParams.forEach((value, key) => {
    if (!key.startsWith(filterPrefix)) {
      return;
    }

    const filterId = key.slice(filterPrefix.length);
    if (!filterId || seenFilterIds.has(filterId)) {
      return;
    }

    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return;
    }

    parsedFilters.push({
      id: filterId,
      value: normalizedValue,
    });
  });

  if (parsedFilters.length === 0 && defaultColumnFilters.length > 0) {
    parsedFilters.push(...defaultColumnFilters);
  }

  return normalizeDataTableQueryState({
    columnFilters: parsedFilters,
    search,
    sorting,
  });
}

export function buildDataTableQueryParams(
  state: DataTableQueryState,
  config: DataTableQueryConfig = {},
  baseParams?: URLSearchParams | ReadonlyURLSearchParams,
) {
  const searchParam = getConfigValue(config.searchParam, DEFAULT_SEARCH_PARAM);
  const sortParam = getConfigValue(config.sortParam, DEFAULT_SORT_PARAM);
  const filterPrefix = getConfigValue(config.filterPrefix, DEFAULT_FILTER_PREFIX);

  const nextParams = new URLSearchParams(baseParams?.toString() ?? "");
  const normalizedState = normalizeDataTableQueryState(state);

  nextParams.delete(searchParam);
  nextParams.delete(sortParam);

  Array.from(nextParams.keys()).forEach((key) => {
    if (key.startsWith(filterPrefix)) {
      nextParams.delete(key);
    }
  });

  if (normalizedState.search) {
    nextParams.set(searchParam, normalizedState.search);
  }

  const activeSort = normalizedState.sorting[0];
  if (activeSort) {
    nextParams.set(sortParam, `${activeSort.id}:${activeSort.desc ? "desc" : "asc"}`);
  }

  normalizedState.columnFilters.forEach((filter) => {
    if (typeof filter.value === "string" && filter.value) {
      nextParams.set(`${filterPrefix}${filter.id}`, filter.value);
    }
  });

  return nextParams;
}

type ReadonlyURLSearchParams = {
  forEach: URLSearchParams["forEach"];
  get: URLSearchParams["get"];
  keys: URLSearchParams["keys"];
  toString(): string;
};
