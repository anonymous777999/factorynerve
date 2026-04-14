"""Saved monitoring queries and executable dashboard views for product events."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


TRUST_GATE_BLOCKS_QUERY_SLUG = "trust-gate-blocks-by-reason-7d"
TRUST_GATE_BLOCKS_QUERY_NAME = "Trust Gate Blocks by Reason (7d)"
TRUST_GATE_BLOCKS_QUERY_SQL = """
SELECT
  properties->>'route' AS route,
  properties->>'block_reason' AS block_reason,
  COUNT(*) AS blocked_attempts,
  ROUND(AVG((properties->>'trust_score')::numeric), 1)
    AS avg_trust_score
FROM product_events
WHERE event_name = 'report_trust_gate_evaluated'
  AND properties->>'passed' = 'false'
  AND occurred_at >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2
ORDER BY blocked_attempts DESC;
""".strip()

TRUST_GATE_BLOCKS_VIEWS = [
    {
        "name": "stacked bar",
        "type": "stacked_bar",
        "x": "route",
        "series": "block_reason",
        "y": "blocked_attempts",
    },
    {
        "name": "table",
        "type": "table",
        "sort": [{"field": "blocked_attempts", "direction": "desc"}],
        "columns": ["route", "block_reason", "blocked_attempts", "avg_trust_score"],
    },
]


def list_monitoring_dashboards() -> list[dict[str, Any]]:
    return [
        {
            "slug": TRUST_GATE_BLOCKS_QUERY_SLUG,
            "name": TRUST_GATE_BLOCKS_QUERY_NAME,
            "sql": TRUST_GATE_BLOCKS_QUERY_SQL,
            "views": TRUST_GATE_BLOCKS_VIEWS,
        }
    ]


def _sqlite_trust_gate_query() -> str:
    return """
    SELECT
      COALESCE(json_extract(properties, '$.route'), 'unknown') AS route,
      COALESCE(json_extract(properties, '$.block_reason'), 'unknown') AS block_reason,
      COUNT(*) AS blocked_attempts,
      ROUND(AVG(CAST(COALESCE(json_extract(properties, '$.trust_score'), 0) AS REAL)), 1) AS avg_trust_score
    FROM product_events
    WHERE event_name = 'report_trust_gate_evaluated'
      AND COALESCE(json_extract(properties, '$.passed'), 0) IN (0, 'false')
      AND occurred_at >= datetime('now', '-7 days')
    GROUP BY 1, 2
    ORDER BY blocked_attempts DESC
    """


def run_trust_gate_blocks_dashboard(db: Session) -> list[dict[str, Any]]:
    dialect = db.bind.dialect.name if db.bind is not None else ""
    sql = _sqlite_trust_gate_query() if dialect == "sqlite" else TRUST_GATE_BLOCKS_QUERY_SQL
    rows = db.execute(text(sql)).mappings().all()
    return [dict(row) for row in rows]


def get_monitoring_dashboard(db: Session, slug: str) -> dict[str, Any]:
    if slug != TRUST_GATE_BLOCKS_QUERY_SLUG:
        raise KeyError(slug)
    return {
        "slug": TRUST_GATE_BLOCKS_QUERY_SLUG,
        "name": TRUST_GATE_BLOCKS_QUERY_NAME,
        "sql": TRUST_GATE_BLOCKS_QUERY_SQL,
        "views": TRUST_GATE_BLOCKS_VIEWS,
        "rows": run_trust_gate_blocks_dashboard(db),
    }
