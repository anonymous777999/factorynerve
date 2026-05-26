import type {
  AriaAttributes,
  ComponentPropsWithoutRef,
  CSSProperties,
  HTMLAttributes,
  MouseEventHandler,
  Ref,
  ReactNode,
} from "react";

export type Density = "compact" | "default" | "touch";
export type TableDensityMode = Density | "comfortable";
export type BulkActionVariant = "primary" | "secondary" | "danger" | "ai";
export type AIPanelMode = "docked" | "overlay";
export type AIPanelPosition = "right" | "left";
export type PanelSurface = "ground" | "workspace" | "elevated" | "raised" | "overlay" | "ai";
export type PanelState = "default" | "selected" | "active" | "ai" | "warning" | "critical";
export type ScrollAreaOrientation = "vertical" | "horizontal" | "both";
export type TooltipPlacement = "top" | "bottom" | "left" | "right";
export type PopoverPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end";
export type ToolbarSurface = "workspace" | "ai";
export type ToolbarSectionAlign = "start" | "center" | "end" | "between";
export type ViewportDockSide = "left" | "right" | "top" | "bottom";
export type ViewportResizeAxis = "horizontal" | "vertical";
export type ViewportStickyEdge = "top" | "bottom";
export type ViewportLayer = "base" | "raised" | "panel";
export type WorkspaceRegionRole = "workspace" | "scroll" | "sticky" | "dock" | "boundary" | "layout";
export type DataTableAlignment = "left" | "center" | "right";
export type DataTableSectionTone = "default" | "muted" | "ai" | "warning" | "critical" | "success";
export type DataTableLayoutMode = "fixed" | "auto";
export type DataTableRowState =
  | "default"
  | "pending"
  | "approved"
  | "warning"
  | "critical"
  | "ai-reviewed"
  | "ai-processing"
  | "ai-suggested"
  | "low-confidence"
  | "anomaly-detected"
  | "locked"
  | "archived"
  | "disabled"
  | "syncing"
  | "stale"
  | "flagged";
export type DataTableCellTone = "default" | "neutral" | "ai" | "warning" | "critical" | "success" | "muted";
export type WorkflowStateValue =
  | "pending"
  | "approved"
  | "rejected"
  | "blocked"
  | "in-review"
  | "archived"
  | "syncing"
  | "stale"
  | "locked";
export type QueueStateValue = "queued" | "processing" | "blocked" | "ready" | "stale" | "archived";
export type OCRConfidenceLevel = "high" | "medium" | "low" | "failed";
export type AIReviewState = "unreviewed" | "reviewed" | "processing" | "suggested" | "low-confidence" | "anomaly";
export type OperationalHealthState = "healthy" | "warning" | "critical" | "syncing" | "stale" | "low-confidence";
export type DataTableColumnPin = "left" | "right" | null;
export type DataTableNavigationAxis = "row" | "cell";
export type OCRReviewState = "unreviewed" | "reviewed" | "corrected" | "flagged" | "failed";
export type OCRSplitMode = "document" | "split" | "review";
export type OperationalPresetId = "default" | "review" | "audit" | "compact";
export type FeedbackPriority =
  | "informational"
  | "operational"
  | "warning"
  | "critical"
  | "blocking"
  | "ai-review"
  | "escalation";
export type FeedbackCategory =
  | "workflow"
  | "sync"
  | "ocr"
  | "ai"
  | "approval"
  | "background-job"
  | "system";
export type InteractionState =
  | "hover"
  | "focus"
  | "active"
  | "pressed"
  | "selected"
  | "disabled"
  | "loading"
  | "warning"
  | "critical"
  | "success"
  | "ai-active"
  | "pending"
  | "locked"
  | "reviewed";
export type InteractionTarget =
  | "button"
  | "icon-button"
  | "input"
  | "surface"
  | "toolbar"
  | "popover"
  | "row"
  | "cell"
  | "viewport"
  | "dock"
  | "resize-handle";
export type InteractionTone = "neutral" | "ai" | "warning" | "critical" | "success";

export interface ActiveFilter {
  id: string;
  label: string;
  value: string;
}

export interface InteractionStateFlags {
  active?: boolean;
  aiActive?: boolean;
  critical?: boolean;
  disabled?: boolean;
  focus?: boolean;
  hover?: boolean;
  loading?: boolean;
  locked?: boolean;
  pending?: boolean;
  pressed?: boolean;
  reviewed?: boolean;
  selected?: boolean;
  success?: boolean;
  warning?: boolean;
}

export interface InteractionRecipeOptions {
  className?: string;
  states?: InteractionState[];
  target: InteractionTarget;
  tone?: InteractionTone;
}

export interface DataTableRowStateFlags {
  approved?: boolean;
  aiProcessing?: boolean;
  aiReviewed?: boolean;
  aiSuggested?: boolean;
  anomalyDetected?: boolean;
  archived?: boolean;
  critical?: boolean;
  disabled?: boolean;
  flagged?: boolean;
  locked?: boolean;
  lowConfidence?: boolean;
  pending?: boolean;
  stale?: boolean;
  syncing?: boolean;
  warning?: boolean;
}

export interface WorkflowContext {
  id: string;
  name: string;
  itemLabel?: string;
  totalItems?: number;
  pendingItems?: number;
  flaggedItems?: number;
  summary?: string;
}

export interface SelectionState {
  count: number;
  ids?: string[];
  allPageSelected?: boolean;
  totalSelectedInView?: number;
}

export interface SavedView {
  id: string;
  name: string;
}

export interface BulkAction {
  id: string;
  label: string;
  variant?: BulkActionVariant;
  overflow?: boolean;
  requiresConfirmation?: boolean;
  icon?: ReactNode;
  onAction: (selectedIds: Set<string>) => void;
}

export interface ToolbarProps {
  searchSlot?: ReactNode;
  filterSlot?: ReactNode;
  actionSlot?: ReactNode;
  viewControlSlot?: ReactNode;
  density?: Density;
  onDensityChange?: (density: Density) => void;
  aiPanelOpen?: boolean;
  onAIPanelToggle?: () => void;
  className?: string;
}

export interface ToolbarBaseProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  sticky?: boolean;
  surface?: ToolbarSurface;
}

export interface ToolbarSectionProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  align?: ToolbarSectionAlign;
  grow?: boolean;
  overflow?: "clip" | "scroll" | "visible";
}

export interface ToolbarFilterChip {
  id: string;
  label: string;
  value?: string;
  tone?: "default" | "active" | "ai";
  tooltip?: ReactNode;
  onRemove?: () => void;
}

export interface ToolbarFiltersProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  activeFilters?: ToolbarFilterChip[];
  clearLabel?: string;
  onClearAll?: () => void;
}

export interface ToolbarSearchProps extends Omit<ComponentPropsWithoutRef<"div">, "children" | "onChange" | "onSubmit"> {
  autoExpand?: boolean;
  clearLabel?: string;
  collapsedWidth?: number;
  defaultValue?: string;
  disabled?: boolean;
  expandedWidth?: number;
  inputClassName?: string;
  inputId?: string;
  name?: string;
  onSubmit?: (value: string) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  value?: string;
}

export interface ToolbarActionsProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  justify?: "start" | "end";
}

export interface ToolbarDisplayMode {
  id: string;
  label: string;
  icon?: ReactNode;
  active?: boolean;
  tooltip?: ReactNode;
  onSelect: () => void;
}

export interface ToolbarViewControlsProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  density?: Density;
  densityLabel?: string;
  densityOptions?: Density[];
  displayModes?: ToolbarDisplayMode[];
  onDensityChange?: (density: Density) => void;
}

export interface ToolbarContextProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  label?: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
}

export interface ToolbarStatusItem {
  id: string;
  label: ReactNode;
  value?: ReactNode;
  tone?: "neutral" | "info" | "warning" | "critical" | "ok" | "ai";
  tooltip?: ReactNode;
}

export interface ToolbarStatusRegionProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  items?: ToolbarStatusItem[];
}

export interface ToolbarCommandRegionProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  emphasize?: "default" | "ai";
}

export interface BulkActionBarProps {
  count: number;
  actions: BulkAction[];
  selectedIds?: Iterable<string>;
  onClear: () => void;
  allPageSelected?: boolean;
  totalCount?: number;
  onSelectAllView?: () => void;
  className?: string;
}

export interface AIAnalysisSummaryAction {
  id?: string;
  label: string;
  onClick: () => void;
}

export interface AIAnalysisSummary {
  message: string;
  actions?: AIAnalysisSummaryAction[];
  onDismiss?: () => void;
}

export interface AIAnalysisSummaryBarProps {
  summary: AIAnalysisSummary;
  className?: string;
}

export interface AIPanelContext {
  title: string;
  metrics?: string;
  selectedLabel?: string;
  selectedMeta?: string;
}

export interface AIPanelConfig {
  open: boolean;
  width?: number;
  mode?: AIPanelMode;
  position?: AIPanelPosition;
  persistenceKey?: string;
  minWidth?: number;
  maxWidth?: number;
}

export interface AIPanelContainerProps {
  open: boolean;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  mode?: AIPanelMode;
  position?: AIPanelPosition;
  persistenceKey?: string;
  onClose?: () => void;
  context?: AIPanelContext;
  footerSlot?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export interface TableViewportProps {
  children?: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptySlot?: ReactNode;
  loadingSlot?: ReactNode;
  density?: Density;
  className?: string;
}

export interface FooterProps {
  children?: ReactNode;
  className?: string;
}

export interface ScrollAreaProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  children?: ReactNode;
  contentClassName?: string;
  maxHeight?: number | string;
  orientation?: ScrollAreaOrientation;
  shadow?: boolean;
  viewportClassName?: string;
}

export interface ViewportRegionRegistration {
  id: string;
  owner?: boolean;
  role: WorkspaceRegionRole;
}

export interface ViewportContextValue {
  activeScrollRegionId: string | null;
  boundaryId: string;
  boundaryNode: HTMLDivElement | null;
  registerRegion: (region: ViewportRegionRegistration) => () => void;
  regions: Map<string, ViewportRegionRegistration>;
  setActiveScrollRegionId: (id: string | null) => void;
  setBoundaryNode: (node: HTMLDivElement | null) => void;
}

export interface ViewportProviderProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  boundaryId?: string;
  lockBodyScroll?: boolean;
}

export interface WorkspaceViewportProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  surface?: "canvas" | "workspace" | "ai";
}

export interface ViewportBoundaryProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  ownerId?: string;
}

export interface WorkspaceLayoutRegionProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  direction?: "horizontal" | "vertical";
  grow?: boolean;
  overflow?: "hidden" | "clip" | "visible";
}

export interface ScrollRegionProps extends Omit<ScrollAreaProps, "title"> {
  ownerId?: string;
}

export interface StickyRegionProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  edge?: ViewportStickyEdge;
  layer?: ViewportLayer;
  offset?: number | string;
  surface?: ToolbarSurface | "workspace";
}

export interface WorkspaceResizeHandleProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  axis?: ViewportResizeAxis;
  onResizeStart?: MouseEventHandler<HTMLDivElement>;
}

export interface ResizeRegionProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  axis?: ViewportResizeAxis;
  defaultSize?: number;
  maxSize?: number;
  minSize?: number;
  onSizeChange?: (size: number) => void;
  persistenceKey?: string;
  position?: ViewportDockSide;
  size?: number;
}

export interface DockRegionProps extends Omit<ComponentPropsWithoutRef<"aside">, "title"> {
  collapsed?: boolean;
  collapsedSize?: number;
  defaultSize?: number;
  maxSize?: number;
  minSize?: number;
  onCollapsedChange?: (collapsed: boolean) => void;
  onSizeChange?: (size: number) => void;
  persistenceKey?: string;
  resizable?: boolean;
  side?: ViewportDockSide;
  size?: number;
}

export interface TooltipProps {
  children: ReactNode;
  className?: string;
  content: ReactNode;
  delay?: number;
  disabled?: boolean;
  id?: string;
  offset?: number;
  placement?: TooltipPlacement;
}

export interface PopoverTriggerRenderProps {
  "aria-controls": string;
  "aria-expanded": boolean;
  "aria-haspopup": AriaAttributes["aria-haspopup"];
  onClick: () => void;
  onKeyDown: HTMLAttributes<HTMLElement>["onKeyDown"];
  ref: Ref<HTMLElement>;
}

export interface PopoverRenderProps {
  close: () => void;
  open: boolean;
}

export interface PopoverProps {
  children: ReactNode | ((props: PopoverRenderProps) => ReactNode);
  className?: string;
  closeOnSelect?: boolean;
  contentClassName?: string;
  defaultOpen?: boolean;
  disabled?: boolean;
  id?: string;
  offset?: number;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  placement?: PopoverPlacement;
  trigger: ReactNode | ((props: PopoverTriggerRenderProps) => ReactNode);
}

export interface DataTableColumnDefinition {
  id?: string;
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
}

export interface DataTableProps extends Omit<ComponentPropsWithoutRef<"table">, "cellPadding" | "cellSpacing" | "title"> {
  density?: Density;
  layout?: DataTableLayoutMode;
  stickyHeader?: boolean;
  striped?: boolean;
}

export interface DataTableColumnProps extends Omit<ComponentPropsWithoutRef<"col">, "title"> {
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
}

export interface DataTableHeaderProps extends Omit<ComponentPropsWithoutRef<"thead">, "title"> {
  sticky?: boolean;
}

export interface DataTableBodyProps extends Omit<ComponentPropsWithoutRef<"tbody">, "title"> {
  empty?: boolean;
}

export interface DataTableRowProps extends Omit<ComponentPropsWithoutRef<"tr">, "title"> {
  active?: boolean;
  aiActive?: boolean;
  aiProcessing?: boolean;
  aiReviewed?: boolean;
  aiSuggested?: boolean;
  anomalyDetected?: boolean;
  approved?: boolean;
  archived?: boolean;
  critical?: boolean;
  disabled?: boolean;
  flagged?: boolean;
  interactive?: boolean;
  loading?: boolean;
  locked?: boolean;
  lowConfidence?: boolean;
  pending?: boolean;
  reviewed?: boolean;
  selected?: boolean;
  stale?: boolean;
  state?: DataTableRowState | DataTableRowState[];
  success?: boolean;
  syncing?: boolean;
  warning?: boolean;
}

export interface DataTableCellProps extends Omit<ComponentPropsWithoutRef<"td">, "title"> {
  active?: boolean;
  align?: DataTableAlignment;
  aiActive?: boolean;
  critical?: boolean;
  disabled?: boolean;
  loading?: boolean;
  meta?: ReactNode;
  mono?: boolean;
  pending?: boolean;
  reviewed?: boolean;
  selected?: boolean;
  stacked?: boolean;
  success?: boolean;
  tone?: DataTableCellTone;
  truncate?: boolean;
  warning?: boolean;
}

export interface DataTableHeaderCellProps extends Omit<ComponentPropsWithoutRef<"th">, "title"> {
  align?: DataTableAlignment;
  auxiliary?: ReactNode;
  mono?: boolean;
  sortable?: boolean;
  sorted?: "asc" | "desc" | false;
  truncate?: boolean;
}

export interface DataTableSectionProps extends Omit<ComponentPropsWithoutRef<"tbody">, "title"> {
  description?: ReactNode;
  label?: ReactNode;
  tone?: DataTableSectionTone;
}

export interface DataTableRowGroupProps extends Omit<ComponentPropsWithoutRef<"tr">, "title"> {
  caption?: ReactNode;
  colSpan?: number;
  description?: ReactNode;
}

export interface DataTableSelectionRegionProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  checked?: boolean;
  disabled?: boolean;
  indeterminate?: boolean;
  mode?: "bulk" | "row";
}

export interface DataTableSemanticCellProps extends Omit<DataTableCellProps, "children" | "align" | "meta" | "mono"> {
  label?: ReactNode;
  secondary?: ReactNode;
}

export interface DataTableEngineColumn {
  id: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  pinned?: DataTableColumnPin;
  resizable?: boolean;
  visible?: boolean;
}

export interface DataTableSavedView {
  id: string;
  label: string;
  density: TableDensityMode;
  hiddenColumnIds: string[];
  pinnedColumns?: Partial<Record<string, DataTableColumnPin>>;
  rowPinning?: { top?: string[]; bottom?: string[] };
  sorting?: Array<{ desc: boolean; id: string }>;
  widths?: Record<string, number>;
}

export interface DataTableVirtualItem {
  index: number;
  key: string;
  offset: number;
  size: number;
}

export interface DataTableEditingValue {
  mode: "edit" | "idle";
  value?: unknown;
}

export interface DataTableEditingSession {
  cellId: string;
  columnId: string;
  rowId: string;
}

export interface TableNavigationCell {
  cellId: string;
  columnId: string;
  rowId: string;
  index: number;
}

export interface TableNavigationState {
  activeCellId: string | null;
  activeRowId: string | null;
  axis: DataTableNavigationAxis;
}

export interface TableNavigationContextValue {
  activeCellId: string | null;
  activeRowId: string | null;
  axis: DataTableNavigationAxis;
  focusCell: (cellId: string) => void;
  focusRow: (rowId: string) => void;
  getNextCellId: (cellId: string, direction: "up" | "down" | "left" | "right") => string | null;
  registerCell: (cell: TableNavigationCell) => () => void;
}

export interface DataTableEngineContextValue {
  columns: DataTableEngineColumn[];
  density: TableDensityMode;
  editingValues: Record<string, DataTableEditingValue>;
  editingSession: DataTableEditingSession | null;
  expandedRowIds: Set<string>;
  hiddenColumnIds: Set<string>;
  navigation: TableNavigationContextValue;
  pinnedOffsets: Record<string, number>;
  rowPinning: { bottom: string[]; top: string[] };
  rowIds: string[];
  savedViews: DataTableSavedView[];
  selectedRowIds: Set<string>;
  sorting: Array<{ desc: boolean; id: string }>;
  activeViewId: string | null;
  applySavedView: (viewId: string) => void;
  clearEditingValue: (cellId: string) => void;
  pinRow: (rowId: string, position: "top" | "bottom" | null) => void;
  saveView: (view: Omit<DataTableSavedView, "id"> & { id?: string }) => string;
  setColumnPin: (columnId: string, pin: DataTableColumnPin) => void;
  setColumnVisibility: (columnId: string, visible: boolean) => void;
  setDensity: (density: TableDensityMode) => void;
  setEditingValue: (cellId: string, value: DataTableEditingValue | null) => void;
  setEditingSession: (session: DataTableEditingSession | null) => void;
  setExpanded: (rowId: string, expanded: boolean) => void;
  setSorting: (sorting: Array<{ desc: boolean; id: string }>) => void;
  setSelection: (updater: Set<string> | ((current: Set<string>) => Set<string>)) => void;
  updateColumnWidth: (columnId: string, width: number) => void;
  widths: Record<string, number>;
}

export interface DataTableEngineProviderProps {
  children: ReactNode;
  columns: DataTableEngineColumn[];
  defaultActiveViewId?: string | null;
  defaultDensity?: TableDensityMode;
  defaultExpandedRowIds?: string[];
  defaultHiddenColumnIds?: string[];
  defaultPresets?: Partial<Record<OperationalPresetId, Partial<DataTableSavedView>>>;
  defaultPinnedColumns?: Partial<Record<string, DataTableColumnPin>>;
  defaultRowPinning?: { bottom?: string[]; top?: string[] };
  defaultSelectedRowIds?: string[];
  defaultSorting?: Array<{ desc: boolean; id: string }>;
  defaultViews?: DataTableSavedView[];
  defaultWidths?: Record<string, number>;
  persistenceKey?: string;
  rowIds?: string[];
}

export interface VirtualizedTableViewportProps<TData> extends Omit<ScrollRegionProps, "children"> {
  emptySlot?: ReactNode;
  estimatedRowHeight?: number;
  header?: ReactNode;
  overscan?: number;
  renderRow: (row: TData, index: number) => ReactNode;
  rowHeight?: number;
  rowKey: (row: TData, index: number) => string;
  rows: TData[];
}

export interface ProductionDataTableColumn<TData> {
  accessorKey?: string;
  accessorFn?: (row: TData) => unknown;
  cell: (context: {
    columnId: string;
    isEditing: boolean;
    row: TData;
    rowId: string;
    value: unknown;
  }) => ReactNode;
  enableEditing?: boolean;
  enablePinning?: boolean;
  enableResizing?: boolean;
  enableSorting?: boolean;
  footer?: ReactNode;
  header: ReactNode;
  id: string;
  maxSize?: number;
  minSize?: number;
  size?: number;
}

export interface ProductionDataTableProps<TData> {
  columns: ProductionDataTableColumn<TData>[];
  data: TData[];
  density?: TableDensityMode;
  emptySlot?: ReactNode;
  getRowId?: (row: TData, index: number) => string;
  persistenceKey?: string;
  savedViews?: DataTableSavedView[];
}

export interface ColumnResizeSystemProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  columnId: string;
}

export interface ColumnPinningSystemProps {
  children?: ReactNode | ((api: { pin: (side: Exclude<DataTableColumnPin, null>) => void; unpin: () => void }) => ReactNode);
  columnId: string;
}

export interface StickyColumnLayerProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  columnId: string;
}

export interface KeyboardNavigationSystemProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  children?: ReactNode;
}

export interface BulkSelectionSystemProps {
  children?: ReactNode | ((api: {
    clear: () => void;
    isSelected: (rowId: string) => boolean;
    selectAll: () => void;
    toggle: (rowId: string, options?: { rangeTo?: string }) => void;
  }) => ReactNode);
}

export interface InlineEditingFoundationProps {
  children?: ReactNode | ((api: {
    cancel: () => void;
    editingSession: DataTableEditingSession | null;
    startEditing: (session: DataTableEditingSession) => void;
  }) => ReactNode);
}

export interface RowExpansionSystemProps {
  children?: ReactNode | ((api: {
    collapseAll: () => void;
    isExpanded: (rowId: string) => boolean;
    toggleExpanded: (rowId: string) => void;
  }) => ReactNode);
}

export interface ColumnVisibilitySystemProps {
  children?: ReactNode | ((api: {
    hiddenColumnIds: Set<string>;
    isVisible: (columnId: string) => boolean;
    toggleColumn: (columnId: string) => void;
  }) => ReactNode);
}

export interface TableDensitySystemProps {
  children?: ReactNode | ((api: {
    density: TableDensityMode;
    setDensity: (density: TableDensityMode) => void;
  }) => ReactNode);
}

export interface OCRBoundingBox {
  id: string;
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number | null;
  label?: string;
  anomaly?: boolean;
  reviewState?: OCRReviewState;
}

export interface OCRExtractionField {
  id: string;
  label: string;
  value: ReactNode;
  confidence?: number | null;
  reviewState?: OCRReviewState;
  pageId?: string;
  boundingBoxId?: string;
  meta?: ReactNode;
}

export interface OCRWorkspacePage {
  id: string;
  pageNumber: number;
  title?: string;
  status?: WorkflowStateValue | QueueStateValue | "ready";
  completeness?: number;
  imageSrc?: string;
}

export interface OCRWorkspaceDocument {
  id: string;
  title: string;
  pages: OCRWorkspacePage[];
}

export interface OCRWorkspaceContextValue {
  activePageId: string | null;
  activeSelectionId: string | null;
  boundingBoxes: OCRBoundingBox[];
  document: OCRWorkspaceDocument;
  extractionFields: OCRExtractionField[];
  scale: number;
  selectedFieldId: string | null;
  splitMode: OCRSplitMode;
  setActivePageId: (pageId: string) => void;
  setScale: (scale: number) => void;
  setSelectedFieldId: (fieldId: string | null) => void;
  setSelectionId: (selectionId: string | null) => void;
  setSplitMode: (mode: OCRSplitMode) => void;
}

export interface OCRWorkspaceProviderProps {
  children: ReactNode;
  defaultActivePageId?: string;
  defaultScale?: number;
  defaultSelectedFieldId?: string | null;
  defaultSelectionId?: string | null;
  defaultSplitMode?: OCRSplitMode;
  document: OCRWorkspaceDocument;
  boundingBoxes?: OCRBoundingBox[];
  extractionFields?: OCRExtractionField[];
}

export interface OCRWorkspaceProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  children?: ReactNode;
  title?: ReactNode;
  toolbarSlot?: ReactNode;
}

export interface DocumentViewportProps extends Omit<ScrollRegionProps, "children"> {
  children?: ReactNode;
  pageSlot?: (page: OCRWorkspacePage, index: number) => ReactNode;
}

export interface PageNavigatorProps extends Omit<ComponentPropsWithoutRef<"nav">, "title"> {
  pages?: OCRWorkspacePage[];
}

export interface OCROverlayLayerProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  boxes?: OCRBoundingBox[];
}

export interface BoundingBoxSystemProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  box: OCRBoundingBox;
}

export interface OCRSelectionSystemProps {
  children?: ReactNode | ((api: {
    isSelected: (boxId: string) => boolean;
    select: (boxId: string | null) => void;
  }) => ReactNode);
}

export interface ExtractionReviewPanelProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  fields?: OCRExtractionField[];
}

export interface ConfidenceReviewLayerProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  boxes?: OCRBoundingBox[];
  threshold?: number;
}

export interface DocumentSplitViewProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  documentSlot?: ReactNode;
  reviewSlot?: ReactNode;
}

export interface FeedbackItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  priority: FeedbackPriority;
  category?: FeedbackCategory;
  progress?: number;
  persistent?: boolean;
  scope?: string;
  timestamp?: number;
}

export interface FeedbackContextValue {
  dismissFeedback: (id: string) => void;
  feedbackItems: FeedbackItem[];
  pushFeedback: (item: Omit<FeedbackItem, "id" | "timestamp"> & { id?: string; timestamp?: number }) => string;
  updateFeedback: (id: string, updater: Partial<FeedbackItem> | ((current: FeedbackItem) => FeedbackItem)) => void;
  clearFeedback: (scope?: string) => void;
}

export interface ToastProviderProps {
  children: ReactNode;
  initialItems?: FeedbackItem[];
  maxVisible?: number;
}

export interface ToastSystemProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  item: FeedbackItem;
  onDismiss?: (id: string) => void;
}

export interface ToastViewportProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  limit?: number;
}

export interface InlineStatusSystemProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  label: ReactNode;
  meta?: ReactNode;
  priority?: FeedbackPriority;
}

export interface WorkflowBannerProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  action?: ReactNode;
  description?: ReactNode;
  priority?: FeedbackPriority;
  title: ReactNode;
}

export interface AINotificationCenterProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  items?: FeedbackItem[];
}

export interface ProgressIndicatorProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  label?: ReactNode;
  priority?: FeedbackPriority;
  value: number;
}

export interface OperationalAlertProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  action?: ReactNode;
  description?: ReactNode;
  priority?: FeedbackPriority;
  title: ReactNode;
}

export interface FeedbackQueueProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  items?: FeedbackItem[];
  scope?: string;
}

export interface FeedbackPriorityLayerProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  items?: FeedbackItem[];
}

export interface WorkflowFeedbackPanelProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  items?: FeedbackItem[];
  title?: ReactNode;
}

export interface CurrencyCellProps extends Omit<DataTableSemanticCellProps, "children"> {
  currency?: string;
  decimals?: number;
  value: number | null;
}

export interface StatusCellProps extends DataTableSemanticCellProps {
  state: WorkflowStateValue;
  value?: ReactNode;
}

export interface OCRConfidenceCellProps extends DataTableSemanticCellProps {
  confidence?: number | null;
  extractionState?: "pending" | "reviewed" | "failed" | "ai-assisted";
  label?: ReactNode;
}

export interface AIAnomalyCellProps extends DataTableSemanticCellProps {
  severity: "none" | "low" | "medium" | "high" | "critical";
  reviewState?: AIReviewState;
  suggestion?: ReactNode;
}

export interface TimestampCellProps extends Omit<DataTableSemanticCellProps, "children"> {
  format?: "datetime" | "date" | "time" | "relative";
  value: Date | number | string | null;
}

export interface WorkflowStateCellProps extends DataTableSemanticCellProps {
  state: WorkflowStateValue;
  owner?: ReactNode;
}

export interface MetadataCellProps extends DataTableSemanticCellProps {
  value: ReactNode;
}

export interface SupplierCellProps extends DataTableSemanticCellProps {
  name: ReactNode;
  code?: ReactNode;
  location?: ReactNode;
}

export interface EditableCellProps extends DataTableSemanticCellProps {
  editable?: boolean;
  value: ReactNode;
}

export interface TagCellProps extends DataTableSemanticCellProps {
  tags: Array<{
    id: string;
    label: ReactNode;
    tone?: DataTableCellTone;
  }>;
}

export interface ProgressCellProps extends DataTableSemanticCellProps {
  value: number;
  max?: number;
  label?: ReactNode;
}

export interface QueueStateCellProps extends DataTableSemanticCellProps {
  state: QueueStateValue;
  count?: number;
}

export interface AIReviewCellProps extends DataTableSemanticCellProps {
  state: AIReviewState;
  summary?: ReactNode;
}

export interface OperationalHealthCellProps extends DataTableSemanticCellProps {
  state: OperationalHealthState;
  value?: ReactNode;
}

export interface DataTableShellProps {
  workflow: string;
  title?: string;
  density?: Density;
  onDensityChange?: (density: Density) => void;
  aiPanel?: AIPanelConfig;
  onAIPanelToggle?: () => void;
  searchSlot?: ReactNode;
  filterSlot?: ReactNode;
  actionSlot?: ReactNode;
  viewControlSlot?: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  selection?: SelectionState;
  bulkActions?: BulkAction[];
  onClearSelection?: () => void;
  totalCount?: number;
  onSelectAllView?: () => void;
  aiSummary?: AIAnalysisSummary;
  aiPanelContent?: ReactNode;
  aiPanelContext?: AIPanelContext;
  emptySlot?: ReactNode;
  loadingSlot?: ReactNode;
  footerSlot?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export interface UsePanelResizeOptions {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  persistenceKey?: string;
  position?: AIPanelPosition;
}

export interface UsePanelResizeReturn {
  width: number;
  setWidth: (width: number) => void;
  handleDragStart: MouseEventHandler<HTMLDivElement>;
}

export interface PanelBaseProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  variant?: "workspace" | "inspector" | "ai" | "floating";
  surface?: PanelSurface;
  state?: PanelState;
  density?: Density;
  padding?: "none" | "compact" | "default" | "comfortable";
  scrollable?: boolean;
  stickyHeader?: boolean;
  stickyFooter?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
}

export interface PanelHeaderProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  sticky?: boolean;
}

export interface PanelBodyProps extends ComponentPropsWithoutRef<"div"> {
  padding?: "none" | "compact" | "default" | "comfortable";
  scrollable?: boolean;
}

export interface PanelFooterProps extends ComponentPropsWithoutRef<"div"> {
  sticky?: boolean;
}

export interface PanelToolbarProps extends ComponentPropsWithoutRef<"div"> {
  startSlot?: ReactNode;
  centerSlot?: ReactNode;
  endSlot?: ReactNode;
  sticky?: boolean;
}

export interface PanelSectionProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  inset?: boolean;
}

export interface PanelEmptyStateProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export interface PanelLoadingStateProps extends ComponentPropsWithoutRef<"div"> {
  rows?: number;
  tone?: "default" | "ai";
}

export interface PanelVariantDefinition {
  surface: PanelSurface;
  stateRing?: string;
  borderAccent?: string;
  rootClassName: string;
  headerClassName: string;
  footerClassName: string;
  toolbarClassName: string;
}

export interface PanelStyleRecipe {
  root: string;
  body: string;
  header: string;
  footer: string;
}

export interface PanelMotionStyle {
  enterClassName: string;
  exitClassName: string;
  style?: CSSProperties;
}
