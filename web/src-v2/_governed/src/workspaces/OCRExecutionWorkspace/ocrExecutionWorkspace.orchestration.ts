import type { FeedbackItem } from "../../../types/datatable";
import type {
  OCRExecutionDerivedPanels,
  OCRExecutionFilters,
  OCRExecutionKpiSet,
  OCRExecutionQueueFilter,
  OCRExecutionRecord,
} from "./ocrExecutionWorkspace.contracts";

export function filterOCRExecutionRecords(records: OCRExecutionRecord[], filters: OCRExecutionFilters) {
  const query = filters.query.trim().toLowerCase();

  return records.filter((record) => {
    const matchesQuery =
      !query ||
      [record.queue.id, record.queue.title, record.queue.supplier, record.queue.source, record.document.title]
        .join(" ")
        .toLowerCase()
        .includes(query);

    const matchesQueueFilter = matchesRecordFilter(record, filters.queueFilter);
    const matchesAnomalyToggle = !filters.anomaliesOnly || record.queue.anomalyCount > 0;

    return matchesQuery && matchesQueueFilter && matchesAnomalyToggle;
  });
}

function matchesRecordFilter(record: OCRExecutionRecord, filter: OCRExecutionQueueFilter) {
  switch (filter) {
    case "completed":
      return record.queue.workflowState === "approved";
    case "escalated":
      return record.queue.queueState === "blocked" || record.queue.reviewState === "anomaly";
    case "low-confidence":
      return record.queue.confidence < 0.8 || record.queue.reviewState === "low-confidence";
    case "pending":
      return record.queue.workflowState === "pending" || record.queue.workflowState === "in-review";
    case "all":
    default:
      return true;
  }
}

export function deriveOCRExecutionKpis(records: OCRExecutionRecord[]): OCRExecutionKpiSet {
  return {
    ready: records.filter((record) => record.queue.queueState === "ready").length,
    lowConfidence: records.filter((record) => record.queue.confidence < 0.8).length,
    escalated: records.filter((record) => record.queue.queueState === "blocked" || record.queue.reviewState === "anomaly").length,
    throughput: records.reduce((total, record) => total + record.queue.completedFields, 0),
  };
}

export function deriveOCRExecutionPanels(record: OCRExecutionRecord): OCRExecutionDerivedPanels {
  const lowConfidenceFields = record.extractionFields.filter(
    (field) => typeof field.confidence === "number" && field.confidence < 0.8
  );

  const aiRecommendationItems: FeedbackItem[] = record.aiRecommendations.map((recommendation, index) => ({
    id: `${record.queue.id}-ai-${index}`,
    title: `AI recommendation ${index + 1}`,
    description: recommendation,
    category: "ai",
    priority: index === 0 ? "ai-review" : "informational",
    scope: "ocr-ai",
  }));

  const lowConfidenceItems: FeedbackItem[] = lowConfidenceFields.map((field) => ({
    id: `${record.queue.id}-${field.id}-confidence`,
    title: `${field.label} requires validation`,
    description: field.meta,
    meta: typeof field.confidence === "number" ? `${Math.round(field.confidence * 100)}% confidence` : undefined,
    category: "ocr",
    priority: field.reviewState === "failed" ? "critical" : "ai-review",
    scope: "ocr-ai",
  }));

  const aiItems: FeedbackItem[] = [
    ...aiRecommendationItems,
    ...lowConfidenceItems,
  ];

  const workflowItems: FeedbackItem[] = [
    {
      id: `${record.queue.id}-workflow-state`,
      title: `${record.queue.title} is ${record.queue.workflowState}`,
      description: `${record.queue.completedFields} of ${record.queue.fieldCount} fields are ready for operational completion.`,
      meta: `Queue ${record.queue.queueState}`,
      category: "workflow",
      priority: record.queue.workflowState === "approved" ? "informational" : "operational",
      scope: "ocr-workflow",
    },
    {
      id: `${record.queue.id}-review-owner`,
      title: `Assigned reviewer: ${record.queue.assignee}`,
      description: `${record.queue.supplier} document is active in the OCR execution lane.`,
      meta: record.queue.id,
      category: "approval",
      priority: "informational",
      scope: "ocr-workflow",
    },
  ];

  const escalationItems: FeedbackItem[] = record.queue.anomalyCount
    ? [
        {
          id: `${record.queue.id}-escalation`,
          title: `${record.queue.anomalyCount} anomaly checks are blocking completion`,
          description: "Review queue escalation before posting extracted values to downstream workflows.",
          meta: `${record.queue.source} / ${record.document.title}`,
          category: "ocr",
          priority: record.queue.reviewState === "anomaly" ? "critical" : "warning",
          scope: "ocr-escalation",
        },
      ]
    : [
        {
          id: `${record.queue.id}-escalation-clear`,
          title: "No active escalation holds",
          description: "Current extraction can move through operational approval once reviewer actions complete.",
          category: "workflow",
          priority: "informational",
          scope: "ocr-escalation",
        },
      ];

  return {
    aiItems,
    escalationItems,
    workflowItems,
  };
}

export function buildQueueFilterChips(filters: OCRExecutionFilters) {
  const chips = [];

  if (filters.queueFilter !== "all") {
    chips.push({
      id: "queue-filter",
      label: "Lane",
      value: filters.queueFilter.replace("-", " "),
      tone: "active" as const,
    });
  }

  if (filters.anomaliesOnly) {
    chips.push({
      id: "anomaly-filter",
      label: "Anomalies",
      value: "Only",
      tone: "ai" as const,
    });
  }

  return chips;
}
