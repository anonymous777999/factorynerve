# D-14: Audit Log Partitioning & Retention

## Status
**Implemented** — July 2026

## Context
The `audit_logs` table grows unbounded over time. It holds operational audit trails, feedback anomaly alerts, and system events. Query performance degrades as the table grows, and there is no data retention policy.

The table has ~55k rows at implementation time and is queried by `timestamp`, `org_id`, `factory_id`, and `action`.

## Decision

### Partitioning
Implement PostgreSQL **monthly range partitioning** on the `timestamp` column:

1. **Migration** (`20260707_02_audit_log_partitioning.py`):
   - PostgreSQL-only guard (skips on SQLite)
   - Drops existing indexes → recreates PK as `(id, timestamp)` (required for partitioning) → converts to partitioned table → creates monthly partitions → recreates indexes
   - Recreates RLS policies after table swap (lost by `DROP TABLE CASCADE`)
   - Creates `audit_partition_manager()` PL/pgSQL function for auto-partition creation

2. **Archival Service** (`backend/services/audit_archival_service.py`):
   - Daemon thread scheduler (follows existing pattern)
   - Runs daily by default (`AUDIT_ARCHIVAL_POLL_SECONDS`)
   - Three responsibilities per sweep:
     1. **Create future partitions** — ensures partitions exist for 6 months ahead
     2. **Archive hot → cold** — partitions older than `AUDIT_RETENTION_HOT_DAYS` (default 730 = 2yr) are exported to CSV and detached from the table
     3. **Drop expired cold storage** — CSV files older than `AUDIT_RETENTION_COLD_DAYS` (default 1825 = 5yr) are deleted

### Configuration
| Env Var | Default | Description |
|---------|---------|-------------|
| `AUDIT_ARCHIVAL_ENABLED` | `true` | Enable/disable the service |
| `AUDIT_ARCHIVAL_POLL_SECONDS` | `86400` | Sweep interval (daily) |
| `AUDIT_RETENTION_HOT_DAYS` | `730` | Age at which to archive partition to CSV |
| `AUDIT_RETENTION_COLD_DAYS` | `1825` | Age at which to delete CSV archives |
| `AUDIT_ARCHIVE_PATH` | `exports/audit_archive/` | Directory for CSV exports |

## Consequences
- **Positive**: Query performance improves via partition pruning (`WHERE timestamp >= ...`)
- **Positive**: Automatic data lifecycle management — 2yr hot / 5yr cold / deleted after 5yr
- **Positive**: Archive format (CSV) is universally accessible
- **Negative**: Migration must run during maintenance window (brief exclusive lock on `audit_logs`)
- **Negative**: RLS policies are recreated explicitly (coupling between migrations)
- **Negative**: SQLite/other dialects don't support partitioning (service is a no-op)
