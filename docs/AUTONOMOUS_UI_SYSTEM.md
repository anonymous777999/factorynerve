# Autonomous UI System

This document describes the self-improving UI loop that now exists inside DPR.ai.

## What it does

The system continuously:

1. observes real route usage and DOM-level UI risks
2. stores behavior signals and user preferences
3. generates prioritized recommendations from heuristics
4. applies only the safest runtime personalization automatically
5. leaves structural UI refactors as explicit code changes

## System architecture

### Frontend runtime

- [autonomous-ui-agent.tsx](../web/src/components/autonomous-ui-agent.tsx)
  - scans active routes after render
  - captures route dwell time
  - records low-volume interaction signals
  - records long-task performance signals
  - applies auto-prioritized shell favorites when the user has not taken manual control
- [ui-autonomy.ts](../web/src/lib/ui-autonomy.ts)
  - posts telemetry
  - fetches overview, preferences, and recommendations
  - applies safe personalization to nav favorites
- [app-shell.tsx](../web/src/components/app-shell.tsx)
  - keeps favorites synchronized with autonomy updates
  - preserves manual user favorites over automatic suggestions

### Backend runtime

- [ui_autonomy.py](../backend/models/ui_autonomy.py)
  - `UiBehaviorSignal`
  - `UiPreference`
  - `UiRecommendation`
- [ui_autonomy_service.py](../backend/services/ui_autonomy_service.py)
  - decision engine and heuristic evaluation
  - summary generation
  - recommendation refresh logic
  - preference upsert logic
- [ui_autonomy.py](../backend/routers/ui_autonomy.py)
  - `/autonomy/signals`
  - `/autonomy/overview`
  - `/autonomy/preferences`
  - `/autonomy/recommendations`
  - `/autonomy/recommendations/run`

### Scheduled loop

- [run_ui_autonomy_cycle.py](../scripts/run_ui_autonomy_cycle.py)
  - runs one recommendation cycle for users with recent UI activity
  - prints a decision log that can be stored by cron, Task Scheduler, or CI

## Automation flow

1. User opens a route.
2. The frontend agent waits for the page to settle.
3. It scans for:
   - horizontal overflow
   - small tap targets
   - crowded above-the-fold actions
   - missing primary heading
   - long pages
   - long main-thread tasks
4. It records route dwell and interaction signals.
5. The backend stores those signals per user, org, and active factory.
6. The decision engine converts repeated signals into recommendations.
7. The engine updates `priority_routes_auto` when behavior strongly suggests which tabs matter most.
8. The shell applies those routes only when the user has not manually customized favorites.

## MCP usage mapping

This autonomy system is truthful about the tool boundary:

- `Vercel MCP`
  - used outside the app runtime for deployment verification and release confirmation
- `GitHub`
  - used outside the runtime for repo and branch context
- `Figma`
  - used outside the runtime as design input for UI implementation tasks
- `Sentry`
  - used outside the runtime for post-deploy regression review

Inside the app itself, UI analysis is powered by local telemetry and heuristics, not by hidden MCP-only APIs.

## Safe implementation rules

- Core functionality is never changed automatically.
- Runtime auto-changes are limited to low-risk personalization.
- Manual user preferences always win over automatic suggestions.
- Telemetry tables are excluded from audit-log write spam.
- Structural UI fixes stay in source control and go through normal lint, typecheck, build, and test validation.

## Example improvements now implemented

### Automatic detection

- flags routes that overflow horizontally on mobile
- flags controls smaller than 44px
- flags dense first screens with too many competing actions
- flags routes missing a visible page heading
- flags pages that push primary actions too far below the fold
- flags long-task performance spikes

### Automatic personalization

Before:

- shell favorites defaulted to a fixed role-based list

After:

- the system stores `priority_routes_auto` from real usage patterns
- the shell adopts those routes when favorites are still default or autonomy-managed
- once the user manually changes favorites, autonomy stops overriding them

## Decision log shape

The scheduled script prints output like:

```json
{
  "status": "completed",
  "users_processed": 2,
  "window_days": 14,
  "decisions": [
    {
      "user_id": 7,
      "email": "ops@example.com",
      "top_routes": [
        { "route": "/dashboard", "visits": 9, "interactions": 4, "issue_count": 2, "avg_duration_ms": 18400, "long_tasks": 0 }
      ],
      "created": 1,
      "updated": 2,
      "resolved": 0,
      "preference_changed": true,
      "open_recommendations": 2
    }
  ]
}
```

## How to run it

From the repo root:

```bash
python scripts/run_ui_autonomy_cycle.py
```

For continuous operation, schedule that command with Windows Task Scheduler, cron, or your deployment job runner.
