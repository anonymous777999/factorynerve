import type {
  AIReviewState,
  FeedbackItem,
  OCRBoundingBox,
  OCRExtractionField,
  OCRWorkspaceDocument,
  QueueStateValue,
  WorkflowStateValue,
} from "../../../types/datatable";

export type OCRExecutionQueueFilter = "all" | "pending" | "low-confidence" | "escalated" | "completed";

export interface OCRWorkflowTimelineStep {
  id: string;
  label: string;
  detail: string;
  status: "done" | "current" | "pending" | "critical";
  timestamp: string;
}

export interface OCRExecutionQueueItem {
  id: string;
  title: string;
  supplier: string;
  source: string;
  assignee: string;
  pages: number;
  fieldCount: number;
  completedFields: number;
  confidence: number;
  anomalyCount: number;
  queueState: QueueStateValue;
  workflowState: WorkflowStateValue;
  reviewState: AIReviewState;
  lastUpdated: string;
  priority: "normal" | "warning" | "critical";
}

export interface OCRExecutionRecord {
  queue: OCRExecutionQueueItem;
  document: OCRWorkspaceDocument;
  boundingBoxes: OCRBoundingBox[];
  extractionFields: OCRExtractionField[];
  aiRecommendations: string[];
  workflowTimeline: OCRWorkflowTimelineStep[];
}

export interface OCRExecutionKpiSet {
  ready: number;
  lowConfidence: number;
  escalated: number;
  throughput: number;
}

export interface OCRExecutionDerivedPanels {
  aiItems: FeedbackItem[];
  escalationItems: FeedbackItem[];
  workflowItems: FeedbackItem[];
}

export interface OCRExecutionFilters {
  anomaliesOnly: boolean;
  query: string;
  queueFilter: OCRExecutionQueueFilter;
}
