export type OcrVerifyStep = 1 | 2 | 3 | 4;
export type OcrVerifyStatusFilter = "all" | "draft" | "pending" | "rejected" | "approved";
export type OcrVerifyPane = "queue" | "workspace";
export type OcrVerifyTab = "document" | "issues" | "fix";

const VALID_STATUS_FILTERS = new Set<OcrVerifyStatusFilter>([
  "all",
  "draft",
  "pending",
  "rejected",
  "approved",
]);
const VALID_PANES = new Set<OcrVerifyPane>(["queue", "workspace"]);
const VALID_TABS = new Set<OcrVerifyTab>(["document", "issues", "fix"]);

function toSingleValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function buildCanonicalOcrVerifyHref(input: Record<string, string | string[] | undefined>) {
  const legacyId = toSingleValue(input.verification_id);
  const idValue = toSingleValue(input.id) ?? legacyId;
  const workspace = toSingleValue(input.workspace);
  const requestedStep = toSingleValue(input.step);
  const search = toSingleValue(input.q);
  const status = toSingleValue(input.status);
  const pane = toSingleValue(input.pane);
  const tab = toSingleValue(input.tab);

  const params = new URLSearchParams();
  const parsedId = idValue ? Number(idValue) : Number.NaN;
  const id = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  const rawStep = requestedStep ? Number(requestedStep) : Number.NaN;
  const step =
    rawStep >= 1 && rawStep <= 4
      ? (rawStep as OcrVerifyStep)
      : workspace === "intake"
        ? 2
        : id != null
          ? 3
          : 1;

  if (id != null) {
    params.set("id", String(id));
  }
  params.set("step", String(step));

  const normalizedSearch = search?.trim() ?? "";
  if (normalizedSearch) {
    params.set("q", normalizedSearch);
  }

  const normalizedStatus = VALID_STATUS_FILTERS.has((status as OcrVerifyStatusFilter) || "all")
    ? ((status as OcrVerifyStatusFilter) || "all")
    : "all";
  if (normalizedStatus !== "all") {
    params.set("status", normalizedStatus);
  }

  const defaultPane: OcrVerifyPane = id != null && step >= 3 ? "workspace" : "queue";
  if (VALID_PANES.has((pane as OcrVerifyPane) || defaultPane)) {
    const normalizedPane = (pane as OcrVerifyPane) || defaultPane;
    if (normalizedPane !== "queue") {
      params.set("pane", normalizedPane);
    }
  }

  if (VALID_TABS.has((tab as OcrVerifyTab) || "issues")) {
    const normalizedTab = (tab as OcrVerifyTab) || "issues";
    if (normalizedTab !== "issues") {
      params.set("tab", normalizedTab);
    }
  }

  return `/ocr/verify?${params.toString()}`;
}

export function isValidOcrVerifyStatusFilter(value: string | null): value is OcrVerifyStatusFilter {
  return VALID_STATUS_FILTERS.has((value as OcrVerifyStatusFilter) || "all");
}

export function isValidOcrVerifyPane(value: string | null): value is OcrVerifyPane {
  return VALID_PANES.has((value as OcrVerifyPane) || "queue");
}

export function isValidOcrVerifyTab(value: string | null): value is OcrVerifyTab {
  return VALID_TABS.has((value as OcrVerifyTab) || "issues");
}
