"""P0-3: Stock reservation service with confirm/release lifecycle."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.models.steel_inventory_reservation import SteelInventoryReservation
from backend.models.steel_inventory_transaction import SteelInventoryTransaction
from backend.services.steel_service import stock_balances_for_factory

logger = logging.getLogger(__name__)

RESERVATION_TTL_MINUTES = 30


def reserve_stock(
    db: Session,
    *,
    org_id: str,
    factory_id: str,
    item_id: int,
    quantity_kg: float,
    reference_type: str,
    reference_id: str,
    user_id: int | None = None,
) -> int:
    """Reserve stock quantity for an operation.

    Checks available balance (actual - existing reservations) before creating.
    Raises ValueError if insufficient stock.
    """
    if quantity_kg <= 0:
        raise ValueError("Reservation quantity must be positive.")

    # Pessimistic lock on item transactions to serialize concurrent reservations
    db.query(SteelInventoryTransaction).filter(
        SteelInventoryTransaction.item_id == item_id
    ).with_for_update().first()

    balances = stock_balances_for_factory(db, factory_id)
    available = float(balances.get(item_id, 0.0))

    # Subtract already reserved quantities
    existing_reservations = (
        db.query(SteelInventoryReservation)
        .filter(
            SteelInventoryReservation.item_id == item_id,
            SteelInventoryReservation.factory_id == factory_id,
        )
        .all()
    )
    reserved_total = sum(float(r.quantity_kg or 0.0) for r in existing_reservations)
    available -= reserved_total

    if available < quantity_kg:
        raise ValueError(
            f"Insufficient stock: requested {quantity_kg} kg but only "
            f"{round(available, 3)} kg available "
            f"(balance: {round(balances.get(item_id, 0.0), 3)} kg, "
            f"reserved: {round(reserved_total, 3)} kg)."
        )

    reservation = SteelInventoryReservation(
        org_id=org_id,
        factory_id=factory_id,
        item_id=item_id,
        quantity_kg=quantity_kg,
        reference_type=reference_type,
        reference_id=reference_id,
        created_by_user_id=user_id,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESERVATION_TTL_MINUTES),
    )
    db.add(reservation)
    db.flush()
    logger.info(
        "Stock reserved: item=%s qty=%s ref=%s/%s reservation_id=%s",
        item_id, quantity_kg, reference_type, reference_id, reservation.id,
    )
    return int(reservation.id)


def confirm_reservation(
    db: Session,
    reservation_id: int,
) -> None:
    """Convert a reservation to a real inventory transaction and release it."""
    reservation = (
        db.query(SteelInventoryReservation)
        .filter(SteelInventoryReservation.id == reservation_id)
        .with_for_update()
        .first()
    )
    if not reservation:
        raise ValueError(f"Reservation {reservation_id} not found.")

    txn = SteelInventoryTransaction(
        org_id=reservation.org_id,
        factory_id=reservation.factory_id,
        item_id=reservation.item_id,
        transaction_type="dispatch_out",
        quantity_kg=-float(reservation.quantity_kg),
        reference_type=reservation.reference_type,
        reference_id=reservation.reference_id,
        notes=f"Confirmed from reservation #{reservation.id}",
        created_by_user_id=reservation.created_by_user_id,
    )
    db.add(txn)
    db.delete(reservation)
    logger.info("Reservation %s confirmed as transaction.", reservation_id)


def release_reservation(
    db: Session,
    reservation_id: int,
) -> None:
    """Release a reservation without creating a transaction."""
    reservation = (
        db.query(SteelInventoryReservation)
        .filter(SteelInventoryReservation.id == reservation_id)
        .first()
    )
    if not reservation:
        raise ValueError(f"Reservation {reservation_id} not found.")
    db.delete(reservation)
    logger.info("Reservation %s released without transaction.", reservation_id)


def release_stale_reservations(
    db: Session,
    *,
    max_age_minutes: int = RESERVATION_TTL_MINUTES,
) -> int:
    """Release all reservations older than max_age_minutes."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)
    stale = (
        db.query(SteelInventoryReservation)
        .filter(SteelInventoryReservation.created_at < cutoff)
        .all()
    )
    count = len(stale)
    for r in stale:
        db.delete(r)
    if count:
        logger.info("Released %s stale reservations.", count)
    return count
