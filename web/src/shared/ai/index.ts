/**
 * shared/ai — AI-shaped UI primitives.
 *
 * Trust patterns: confidence visualization, AI provenance disclosure,
 * anomaly surfacing. Used by OCR, dashboard, control tower, reports.
 *
 * Rule: every value an AI produced should be rendered with at least one
 * primitive from this folder so the user knows.
 */

export { ConfidenceMeter, getConfidenceTone } from "./confidence-meter";
export { AIDisclosure } from "./ai-disclosure";
export { AnomalyStrip } from "./anomaly-strip";
