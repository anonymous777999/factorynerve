# 02. Interaction Laws

## 1. Philosophy: Industrial Muscle Memory
DPR.ai is a tool, not a toy. Operators value speed, feedback immediacy, and low cognitive load. The UI MUST behave like a predictable machine.

## 2. Laws of Operational Feedback

### 2.1 The 100ms Feedback Law
**Rule:** Every interaction (Click, Tap, Keypress) MUST produce a visible response within 100ms.
*   **Implementation:** Use `:active` states for buttons, loading pulses for data fetches, and intermediate skeleton states.
*   **Banned:** Unresponsive buttons that stay idle while an async request is in flight.

### 2.2 The Law of Point-of-Sight Action
**Rule:** Feedback and secondary actions MUST appear where the user is already looking.
*   **Implementation:** Inline validation for cells. Modal centers for destructive confirms. Error messages immediately below the failing input field.
*   **Banned:** "Global Error Lists" at the top of long forms that require scrolling.

### 2.3 The Law of Truth-at-the-Source
**Rule:** The UI MUST NOT lie about the synchronization state of the data.
*   **Implementation:** Use "Syncing..." and "Saved" status indicators. Explicitly flag stale data older than the `staleTime` defined in React Query governance.
*   **Banned:** Assuming success on a POST request without a visual "Confirmed" signal or toast.

## 3. Mandatory Interaction Patterns

### 3.1 Destructive Confirmation
**Requirement:** Any action that causes irreversible data loss (Delete, Void, Final Submit) REQUIRES a double-action verification.
*   **Pattern:** Modal with high-contrast `var(--critical)` button.

### 3.2 Progressive Disclosure
**Requirement:** Default to "Action Density"; show advanced controls only upon hover or explicit expansion.
*   **Pattern:** Hidden "Row Actions" until hover; Collapsible "Metadata" sections.

### 3.3 Zero-Click Access
**Requirement:** Operators MUST be able to reach any primary data field using the `Tab` key without using a mouse.

## 4. Interaction Feedback Matrix

| Event | Visual Signal | Component Requirement |
| :--- | :--- | :--- |
| **Data Fetching** | Skeleton Shimmer | `LoadingBoundary` wrapper |
| **Action Processing**| Button Busy State | `Button` with `isBusy` prop |
| **Success Result** | Green Toast (3s) | `pushAppToast` call |
| **Sync Failure** | Red Modal + Retry | `ApiErrorBoundary` intervention |
| **Draft Auto-save** | Subtle Status Dot | "Saving..." metadata label |

## 5. Anti-Patterns (Operational Friction)
*   ❌ **Blocking Modals:** Prevent users from seeing data while a modal is open.
*   ❌ **Flickering Skeletons:** Showing a loading state for less than 300ms (causes eye fatigue).
*   ❌ **Invisible Focus:** Elements that lack a high-contrast focus ring for keyboard users.
