/**
 * features/ai — anomaly detection, AI summaries, owner insights.
 *
 * Note: `shared/ai/` holds the UI primitives (ConfidenceMeter,
 * AIDisclosure, AnomalyStrip). This feature is the workspace and
 * server contract that consume those primitives.
 */

export * from "./workspaces";
export * as aiApi from "./api/ai";
