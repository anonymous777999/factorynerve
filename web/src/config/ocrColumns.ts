// Define which column indices should be visible in the OCR spreadsheet grid
// This is a placeholder configuration - adjust based on your actual OCR data structure
//
// Since OCR data comes as OcrCell[][], we work with column indices rather than field names
// The headers array provides the column names dynamically from OCR extraction
//
// Example: If you always want to show the first 5 columns, use [0, 1, 2, 3, 4]
// For now, we'll show all columns by default (empty array = show all)

export const VISIBLE_OCR_COLUMN_INDICES: number[] = [];

// Alternative: If you want to limit visible columns, uncomment and adjust:
// export const VISIBLE_OCR_COLUMN_INDICES: number[] = [0, 1, 2, 3, 4, 5];

// Column constraints
export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 400;
export const DEFAULT_COLUMN_WIDTH = 150;
