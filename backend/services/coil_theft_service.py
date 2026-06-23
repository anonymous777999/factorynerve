"""Coil theft detection service."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from backend.models.alert import Alert
from backend.models.steel_inventory_item import SteelInventoryItem
from backend.models.steel_production_batch import SteelProductionBatch
from backend.database import SessionLocal


def detect_coil_theft(
    db: Session,
    org_id: Optional[str] = None,
    factory_id: Optional[str] = None,
    tolerance_kg: float = 5.0,
    tolerance_percent: float = 0.10,
) -> List[Alert]:
    """
    Detect potential coil theft by comparing expected coil weight (from inventory)
    to actual input quantity in production batches.
    Creates Alert records for suspicious batches.
    Returns list of created Alert objects.
    """
    # Build base query for production batches
    query = db.query(SteelProductionBatch).join(
        SteelInventoryItem,
        SteelProductionBatch.input_item_id == SteelInventoryItem.id,
    )
    if org_id:
        query = query.filter(SteelProductionBatch.org_id == org_id)
    if factory_id:
        query = query.filter(SteelProductionBatch.factory_id == factory_id)
    # Default to last 365 days to prevent full table scan on long-running factories.
    # The function signature can be extended with a days= parameter if callers
    # need a longer lookback window.
    _cutoff_date = datetime.now(timezone.utc).date() - timedelta(days=365)
    query = query.filter(SteelProductionBatch.production_date >= _cutoff_date)
    batches: List[SteelProductionBatch] = query.all()

    alerts: List[Alert] = []
    for batch in batches:
        inv_item: SteelInventoryItem = batch.input_item  # relationship
        # Only consider items where coil weight is defined (coil materials)
        coil_weight = inv_item.coil_weight_kg or 0.0
        if coil_weight <= 0.0:
            continue  # not a coil item

        expected = coil_weight
        actual = batch.input_quantity_kg
        variance_kg = actual - expected
        variance_percent = abs(variance_kg) / expected if expected != 0 else 0.0

        # Determine if suspicious
        suspicious = False
        reason_parts = []
        if abs(variance_kg) > tolerance_kg:
            suspicious = True
            reason_parts.append(f"weight deviation {variance_kg:.2f} kg exceeds tolerance {tolerance_kg} kg")
        if variance_percent > tolerance_percent:
            suspicious = True
            reason_parts.append(f"weight deviation {variance_percent*100:.1f}% exceeds tolerance {tolerance_percent*100:.0f}%")

        if suspicious:
            # Update batch fields for tracking
            batch.coil_expected_weight_kg = expected
            batch.coil_weight_variance_kg = variance_kg
            batch.coil_weight_variance_percent = variance_percent
            batch.is_coil_theft_suspected = True
            # Create alert
            alert = Alert(
                entry_id=0,  # Alerts are tied to entries; we can set to 0 or maybe link to a dummy entry? We'll set to 0 and note in message.
                user_id=0,   # System alert; we can set to a system user ID if exists, else 0.
                alert_type="coil_theft_suspicion",
                message=(
                    f"Coil weight variance detected for batch {batch.batch_code}: "
                    f"expected {expected:.2f} kg, actual {actual:.2f} kg, variance {variance_kg:.2f} kg ({variance_percent*100:.1f}%). "
                    f"{'; '.join(reason_parts)}"
                ),
                severity="high" if variance_percent > 0.25 else "medium",
                is_read=False,
            )
            db.add(alert)
            alerts.append(alert)
    db.commit()
    # Refresh alerts to get IDs
    for alert in alerts:
        db.refresh(alert)
    return alerts