# Requirements Document

## Introduction

This document defines requirements for Sprint 2 of the DPR.ai Frontend Modernization initiative. Sprint 2 focuses on workspace layout modernization, sidebar refinement, AI-native UX integration, interaction polish, operational density refinement, and status system cleanup.

**Sprint 1 Completed**: Typography reset, border reduction, surface simplification, accent color migration, and global CSS modernization.

**Sprint 2 Scope**: Component-level visual refinement to create a calm, modern, operational workspace that feels like Linear/Stripe/Arc Browser rather than cyberpunk/SOC dashboards.

**Critical Constraint**: This is NOT a redesign. This is controlled visual modernization. Architecture, workflows, routing, and backend contracts remain unchanged.

## Glossary

- **Workspace**: The main operational area where users interact with data tables, forms, and AI insights
- **Sidebar**: The left navigation panel containing route links and workspace navigation
- **AI_Insight_Panel**: Component displaying AI-generated suggestions, OCR results, or intelligence cards
- **Status_Chip**: Badge or indicator showing operational state (success, warning, danger, processing, paused)
- **Interaction_State**: Visual feedback for hover, focus, active, disabled, and loading states
- **Operational_Density**: Information density optimized for manufacturing operations (not cramped, not sparse)
- **Surface_Differentiation**: Visual hierarchy created through background color shades rather than heavy borders
- **Visual_Doctrine**: Governance document defining calm, modern, operational visual principles
- **Anti_Pattern**: Forbidden visual pattern documented in governance (UPPERCASE, gradients, glow effects, etc.)
- **AppShell**: Architecture-critical component controlling scroll ownership and layout framing
- **Touch_Target**: Interactive element with minimum 44x44px size for accessibility

## Requirements

### Requirement 1: Workspace Layout Modernization

**User Story:** As an operator, I want a calm and uncluttered workspace layout, so that I can focus on operational data without visual fragmentation.

#### Acceptance Criteria

1. THE Workspace_Layout SHALL use surface differentiation with 2-3% lightness steps between adjacent surface levels instead of heavy borders for visual hierarchy
2. WHEN displaying data tables, THE Workspace_Layout SHALL maintain 40px default row height for breathable operational density
3. THE Workspace_Layout SHALL use 24-32px gaps between major sections for visual breathing room
4. THE Workspace_Layout SHALL preserve AppShell scroll ownership architecture where content scrolls within factory-workstation-frame and page does not create scroll containers
5. WHEN displaying cards or panels, THE Workspace_Layout SHALL use 20-24px padding for modern spacing
6. THE Workspace_Layout SHALL use solid surface colors from design tokens without gradient backgrounds
7. THE Workspace_Layout SHALL maintain explicit height containment for scroll containers using calc expressions or fixed pixel values
8. WHEN displaying nested content, THE Workspace_Layout SHALL avoid creating nested scroll containers
9. IF a flex child component requires scrolling, THEN THE Workspace_Layout SHALL include min-h-0 class on the flex child element
10. WHEN implementing sticky positioning, THE Workspace_Layout SHALL ensure the sticky element's parent has explicit height and overflow-y-auto

### Requirement 2: Sidebar Navigation Refinement

**User Story:** As a user, I want a calm and clear navigation experience, so that I can quickly access different sections without visual noise.

#### Acceptance Criteria

1. THE Sidebar SHALL use sentence case for all navigation labels (not UPPERCASE)
2. WHEN a route is active, THE Sidebar SHALL indicate active state with indigo accent color and medium font weight (500 or 600)
3. THE Sidebar SHALL use 40-48px height for navigation items to ensure adequate touch targets
4. WHEN hovering over navigation items, THE Sidebar SHALL provide background opacity change of 5-10% within 80-120ms
5. THE Sidebar SHALL use 12px horizontal padding and 8-10px vertical padding for navigation item spacing
6. THE Sidebar SHALL maintain visual hierarchy using text opacity differentiation where primary navigation uses 100% opacity, secondary navigation uses 70-80% opacity, and tertiary navigation uses 50-60% opacity
7. WHEN displaying navigation icons, THE Sidebar SHALL use 8px gap between icon and label
8. THE Sidebar SHALL use Inter font family for all navigation text (not monospace)
9. WHEN user presses Tab key, THE Sidebar SHALL move focus to next navigation item with visible focus indicator

### Requirement 3: AI-Native UX Integration

**User Story:** As an operator, I want AI insights to feel integrated and helpful, so that I trust and use AI assistance effectively.

#### Acceptance Criteria

1. WHEN displaying AI processing state, THE AI_Insight_Panel SHALL use calm indigo indicator without pulsing or glow effects
2. THE AI_Insight_Panel SHALL display confidence levels using text labels (High/Medium/Low) with color-coded visual indicators (green for High, amber for Medium, slate for Low)
3. WHEN showing OCR results, THE AI_Insight_Panel SHALL use 16px card padding and 12px internal spacing for readability
4. THE AI_Insight_Panel SHALL use sentence case for all labels and headings (not UPPERCASE)
5. WHEN AI suggestions are presented, THE AI_Insight_Panel SHALL provide inline presentation within the workflow context without modal popups or overlays
6. THE AI_Insight_Panel SHALL use surface differentiation with distinct background color to distinguish AI content from user-entered data
7. WHEN displaying AI reasoning, THE AI_Insight_Panel SHALL show brief explanations in 12px secondary text limited to 280 characters maximum
8. THE AI_Insight_Panel SHALL use indigo accent color for AI-related interactive elements
9. WHEN AI processing fails, THE AI_Insight_Panel SHALL display error state with red indicator and actionable error message
10. WHEN AI suggestions are displayed, THE AI_Insight_Panel SHALL provide accept and dismiss controls for operator to control suggestion application

### Requirement 4: Interaction Polish

**User Story:** As a user, I want smooth and predictable interactions, so that the interface feels responsive and professional.

#### Acceptance Criteria

1. WHEN hovering over interactive elements, THE System SHALL provide background color change feedback within 80-120ms transition duration
2. THE System SHALL use focus ring with minimum 3:1 contrast ratio against background for all keyboard-focused elements
3. WHEN buttons are in loading state, THE System SHALL display indigo spinner with disabled appearance and block further interaction
4. THE System SHALL use standard easing for all state transitions (not spring physics or bounce effects)
5. WHEN interactive elements are disabled, THE System SHALL use muted colors and cursor-not-allowed
6. WHEN user clicks interactive elements, THE System SHALL provide active state feedback with pressed appearance (background opacity change of 10-20%)
7. WHEN displaying hover states, THE System SHALL use background opacity change of 5-15% (not border change)
8. THE System SHALL ensure all interactive elements have minimum 44x44px touch targets
9. THE System SHALL apply 80-120ms transition duration to hover, focus, and active state changes (not to content loading or data fetching)

### Requirement 5: Operational Density Refinement

**User Story:** As an operator, I want balanced information density, so that I can scan data efficiently without feeling cramped or overwhelmed.

#### Acceptance Criteria

1. WHILE in default density mode, THE System SHALL use 40px row height for data tables
2. WHILE in compact density mode, THE System SHALL use 36px row height for data tables
3. WHILE in default density mode, THE System SHALL use 12px horizontal cell padding and 8px vertical cell padding for table cells
4. WHILE in compact density mode, THE System SHALL use 8px horizontal cell padding and 6px vertical cell padding for table cells
5. WHEN displaying form fields, THE System SHALL use 14px font size for labels and body text
6. THE System SHALL use 13px font size for data table cell text
7. THE System SHALL maintain 16px vertical gaps between form fields
8. WHEN displaying numeric data in tables, THE System SHALL use tabular numbers (font-variant-numeric: tabular-nums)
9. THE System SHALL use 16px gaps between card components in grid layouts
10. THE System SHALL use 24px gaps between card components in vertical stack layouts

### Requirement 6: Status and Feedback System Cleanup

**User Story:** As an operator, I want clear and calm status indicators, so that I can quickly assess operational state without anxiety.

#### Acceptance Criteria

1. THE Status_Chip SHALL use sentence case for status labels (not UPPERCASE)
2. WHEN displaying success status, THE Status_Chip SHALL use green foreground with light green background
3. WHEN displaying warning status, THE Status_Chip SHALL use amber foreground with light amber background
4. WHEN displaying danger status, THE Status_Chip SHALL use red foreground with light red background
5. WHEN displaying processing status, THE Status_Chip SHALL use indigo foreground with light indigo background
6. WHEN displaying paused status, THE Status_Chip SHALL use slate foreground with light slate background
7. THE Status_Chip SHALL use 10-11px font size with 600 font weight for badge text
8. THE Status_Chip SHALL use 4-6px horizontal padding and 2-4px vertical padding for compact appearance
9. THE Status_Chip SHALL use 1px border with color matching the status color family
10. THE Status_Chip SHALL avoid pulsing animations or glow effects

### Requirement 7: Component Visual Consistency

**User Story:** As a user, I want consistent visual patterns across all components, so that the interface feels cohesive and predictable.

#### Acceptance Criteria

1. THE System SHALL use Inter font family for all UI text including buttons, labels, headings, and body text
2. THE System SHALL use monospace font exclusively for code snippets, technical identifiers, and timestamps
3. THE System SHALL use sentence case for all UI labels, buttons, and headings, with UPPERCASE permitted only for acronyms
4. THE System SHALL use single indigo accent color for all primary actions and focus states
5. THE System SHALL use 4px base spacing scale for all padding, margins, and gaps
6. THE System SHALL use solid surface colors without gradient backgrounds
7. THE System SHALL maintain 4.5:1 minimum contrast ratio for all body text
8. THE System SHALL use 6-8px border radius for cards, panels, and buttons
9. THE System SHALL use shadows to indicate elevation or layering of interface elements
10. THE System SHALL NOT use glow effects, colored radial gradients, or decorative shadows

### Requirement 8: Responsive Interaction Feedback

**User Story:** As a user, I want immediate feedback for all interactions, so that I know the system is responding to my actions.

#### Acceptance Criteria

1. WHEN clicking buttons or links, THE System SHALL provide visual feedback within 100ms by changing the element's background color or opacity
2. WHEN submitting forms, THE System SHALL display loading state with indigo spinner using color #4338ca
3. WHEN operations succeed, THE System SHALL display success feedback with green indicator (#22c55e) for minimum 3 seconds
4. WHEN operations fail, THE System SHALL display error feedback with red indicator (#ef4444) and actionable error message for minimum 5 seconds
5. WHEN operations are processing, THE System SHALL display indigo (#4338ca) spinner or progress indicator without pulsing or glowing effects
6. WHILE hovering over interactive elements (buttons, links, form controls), THE System SHALL apply transition effects with duration between 80ms and 120ms
7. THE System SHALL use 150ms maximum transition duration for expand/collapse animations
8. THE System SHALL avoid decorative animations (page transitions, parallax, floating elements)
9. WHEN user clicks dismiss control on feedback message, THE System SHALL remove the feedback immediately
10. IF form submission fails to initiate, THEN THE System SHALL display error feedback with red indicator (#ef4444) and error message indicating the submission failure

### Requirement 9: Dark Mode Visual Consistency

**User Story:** As a user, I want dark mode to feel modern and professional, so that I can work comfortably in low-light environments.

#### Acceptance Criteria

1. WHILE dark mode is active, THE System SHALL use dark gray backgrounds (not pure black) for all UI surfaces
2. WHILE dark mode is active, THE System SHALL maintain 2-3% surface differentiation steps in lightness for visual hierarchy
3. WHILE dark mode is active, THE System SHALL use primary text color with minimum 4.5:1 contrast ratio and secondary text color with minimum 3:1 contrast ratio
4. WHILE dark mode is active, THE System SHALL maintain 4.5:1 minimum contrast ratio for text elements
5. WHILE dark mode is active, THE System SHALL use same indigo accent color as light mode for all primary actions and focus states
6. WHILE dark mode is active, THE System SHALL avoid colored radial gradients (no cyberpunk aesthetic)
7. WHILE dark mode is active, THE System SHALL avoid glow effects defined as blur radius >4px or opacity >30%
8. WHILE dark mode is active, THE System SHALL use shadows with 1.5x-2x elevation values compared to light mode for depth perception
9. WHEN user activates dark mode, THE System SHALL transition all UI elements to dark mode within 200ms
10. WHEN user deactivates dark mode, THE System SHALL transition all UI elements to light mode within 200ms

### Requirement 10: Accessibility Compliance

**User Story:** As a user with accessibility needs, I want the interface to be fully accessible, so that I can use the system effectively.

#### Acceptance Criteria

1. THE System SHALL provide focus indicators with minimum 2px visible border for all interactive elements
2. THE System SHALL maintain minimum 44x44px touch targets for all interactive elements
3. THE System SHALL maintain 4.5:1 minimum contrast ratio for text smaller than 18pt regular weight or 14pt bold weight
4. THE System SHALL maintain 3:1 minimum contrast ratio for interactive controls, graphical objects, and visual state indicators
5. THE System SHALL expose semantic roles and labels for all interactive elements to assistive technologies
6. THE System SHALL provide alternative text describing content and function for all images that convey information or functionality
7. IF an image serves purely decorative purpose, THEN THE System SHALL mark the image as decorative to assistive technologies
8. THE System SHALL support navigation and activation of all interactive elements using Tab, Shift+Tab, Enter, Space, and Escape keys
9. WHEN user navigates using keyboard, THE System SHALL maintain visible focus indicator on the currently focused element
10. THE System SHALL communicate status, errors, and state changes through both visual indicators and text labels or icons
11. WHEN form validation error occurs, THEN THE System SHALL identify the error field through text description in addition to visual styling
12. THE System SHALL maintain functionality and readability when text is resized up to 200% of default size

### Requirement 11: Governance Compliance

**User Story:** As a developer, I want clear governance rules, so that I can implement changes that align with visual doctrine.

#### Acceptance Criteria

1. WHEN a developer modifies typography in UI components, THE System SHALL use sentence case for all labels, buttons, headings, and menu items
2. WHEN a developer modifies typography in UI components, THE System SHALL use Inter font family for all UI text
3. WHEN a developer modifies typography in UI components, THE System SHALL use JetBrains Mono font family only for code snippets, technical identifiers, and timestamp displays
4. WHEN a developer adds or modifies color values in UI components, THE System SHALL use indigo #6366f1 as the single primary accent color for all primary actions, links, focus states, and active states
5. WHEN a developer adds or modifies background colors in UI components, THE System SHALL use solid colors from design tokens without gradient backgrounds or glow effects
6. WHEN a developer adds or modifies spacing values in UI components, THE System SHALL use values from the 4px base scale defined in spacing-rhythm.md
7. WHEN a developer modifies row height in tables or lists, THE System SHALL use minimum 40px for default density, 36px for compact density, or 48px for comfortable density
8. WHEN a developer modifies card or panel components, THE System SHALL use minimum 20px padding for default density
9. WHEN a developer creates or modifies page layouts, THE System SHALL render page content into AppShell's scroll container without creating page-level scroll containers
10. WHEN a developer creates scrollable components within pages, THE System SHALL apply explicit height constraints using calc expressions or fixed pixel values
11. IF a developer creates a flex child component that requires scrolling, THEN THE System SHALL include min-h-0 class on the flex child element
12. WHEN a developer modifies the AppShell component scroll architecture, THE System SHALL preserve the overflow-y-auto class on the factory-workstation-frame element
13. WHEN a developer adds interactive elements, THE System SHALL provide minimum 44x44px touch target dimensions
14. WHEN a developer adds text content, THE System SHALL maintain minimum 4.5:1 color contrast ratio between text and background for body text
15. WHEN a developer adds focus-interactive elements, THE System SHALL include visible focus indicators with indigo color and 1px offset

### Requirement 12: Performance Optimization

**User Story:** As a user, I want fast and smooth interactions, so that the interface feels responsive and professional.

#### Acceptance Criteria

1. WHEN user performs button clicks, form inputs, or navigation actions, THE System SHALL provide visual feedback within 100ms
2. THE System SHALL use CSS transitions (not JavaScript animations) for state changes
3. THE System SHALL use maximum 2 concurrent backdrop filters (blur effects) to maintain scroll performance
4. THE System SHALL use optimized images with maximum 1920x1080px dimensions and 500KB file size in WebP format
5. IF browser does not support WebP format, THEN THE System SHALL provide JPEG or PNG fallback images
6. THE System SHALL maintain 60fps scroll performance in data tables
7. WHEN components with bundle size >100KB are positioned 200px or more outside viewport, THE System SHALL lazy load those components
8. THE System SHALL debounce search operations with 300ms delay and filter operations with 150ms delay
9. IF data table contains more than 100 rows, THEN THE System SHALL use virtual scrolling to render only visible rows

