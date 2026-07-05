"""P1-4: Bill of Materials CRUD endpoints + auto-fill batch creation."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.steel_bom import SteelBom, SteelBomLine
from backend.models.steel_inventory_item import SteelInventoryItem
from backend.models.steel_production_batch import SteelProductionBatch
from backend.models.user import User
from backend.authorization import PDP, ResourceContext
from backend.authorization.pdp import build_request_context
from backend.routers.steel import _write_steel_audit, _get_item_or_404
from backend.security import get_current_user
from backend.services.steel_service import (
    generate_batch_code,
    locked_stock_balance_for_item,
    require_active_steel_factory,
    serialize_batch,
    severity_from_variance,
)
from backend.tenancy import resolve_org_id
from backend.utils import sanitize_text

logger = logging.getLogger(__name__)
router = APIRouter(tags=["SteelBom"])


class SteelBomLineCreateRequest(BaseModel):
    item_id: int
    ratio_kg: float = Field(gt=0)
    is_consumable: bool = False
    notes: str | None = Field(default=None, max_length=200)


class SteelBomCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    output_item_id: int
    output_quantity_kg: float = Field(default=1000, gt=0)
    is_default: bool = False
    notes: str | None = Field(default=None, max_length=500)
    lines: list[SteelBomLineCreateRequest] = Field(min_length=1, max_length=50)


class SteelBatchBomFillRequest(BaseModel):
    bom_id: int
    output_quantity_kg: float = Field(gt=0)
    batch_code: str | None = Field(default=None, max_length=40)
    production_date: str
    actual_output_kg: float = Field(gt=0)
    notes: str | None = Field(default=None, max_length=500)


def _serialize_bom(db: Session, bom: SteelBom) -> dict:
    output_item = db.query(SteelInventoryItem).filter(SteelInventoryItem.id == bom.output_item_id).first()
    lines = db.query(SteelBomLine).filter(SteelBomLine.bom_id == bom.id).all()
    item_ids = {line.item_id for line in lines}
    item_map = {}
    if item_ids:
        for item in db.query(SteelInventoryItem).filter(SteelInventoryItem.id.in_(item_ids)).all():
            item_map[item.id] = item
    created_at = bom.created_at
    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    updated_at = bom.updated_at
    if updated_at and updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)
    return {
        "id": bom.id,
        "name": bom.name,
        "output_item_id": bom.output_item_id,
        "output_item_code": output_item.item_code if output_item else None,
        "output_item_name": output_item.name if output_item else None,
        "output_quantity_kg": round(float(bom.output_quantity_kg or 1000.0), 3),
        "is_default": bom.is_default,
        "is_active": bom.is_active,
        "notes": bom.notes,
        "lines": [
            {
                "id": line.id,
                "item_id": line.item_id,
                "item_code": item_map.get(line.item_id).item_code if item_map.get(line.item_id) else None,
                "item_name": item_map.get(line.item_id).name if item_map.get(line.item_id) else None,
                "ratio_kg": round(float(line.ratio_kg), 3),
                "consumable": line.is_consumable,
                "notes": line.notes,
            }
            for line in lines
        ],
        "created_at": created_at.isoformat() if created_at else None,
        "updated_at": updated_at.isoformat() if updated_at else None,
    }


@router.post("/bom", status_code=status.HTTP_201_CREATED)
def create_steel_bom(
    payload: SteelBomCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="inventory.item.manage",
        resource=ResourceContext(factory_id=factory.factory_id),
        request_context=build_request_context(request),
    )
    name = sanitize_text(payload.name, max_length=160, preserve_newlines=False)
    if not name:
        raise HTTPException(status_code=400, detail="BOM name is required.")
    _get_item_or_404(db, factory_id=factory.factory_id, item_id=payload.output_item_id)
    existing = db.query(SteelBom).filter(
        SteelBom.factory_id == factory.factory_id,
        SteelBom.name == name,
        SteelBom.is_active.is_(True),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A BOM with this name already exists.")
    bom = SteelBom(
        org_id=factory.org_id,
        factory_id=factory.factory_id,
        name=name,
        output_item_id=payload.output_item_id,
        output_quantity_kg=payload.output_quantity_kg,
        is_default=payload.is_default,
        notes=sanitize_text(payload.notes, max_length=500),
        created_by_user_id=current_user.id,
    )
    db.add(bom)
    db.flush()
    for line_req in payload.lines:
        _get_item_or_404(db, factory_id=factory.factory_id, item_id=line_req.item_id)
        db.add(SteelBomLine(
            bom_id=bom.id,
            item_id=line_req.item_id,
            ratio_kg=line_req.ratio_kg,
            is_consumable=line_req.is_consumable,
            notes=sanitize_text(line_req.notes, max_length=200),
        ))
    _write_steel_audit(db, actor=current_user, factory_id=factory.factory_id,
                       action="STEEL_BOM_CREATED", details=f"bom={name}", request=request)
    db.commit()
    db.refresh(bom)
    return {"bom": _serialize_bom(db, bom)}


@router.get("/bom")
def list_steel_boms(
    output_item_id: int | None = Query(default=None),
    is_active: bool | None = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    q = db.query(SteelBom).filter(SteelBom.factory_id == factory.factory_id)
    if is_active is not None:
        q = q.filter(SteelBom.is_active.is_(is_active))
    if output_item_id is not None:
        q = q.filter(SteelBom.output_item_id == output_item_id)
    return {"boms": [_serialize_bom(db, b) for b in q.order_by(SteelBom.name.asc()).all()]}


@router.get("/bom/{bom_id}")
def get_steel_bom(
    bom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    bom = db.query(SteelBom).filter(SteelBom.id == bom_id, SteelBom.factory_id == factory.factory_id).first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found.")
    return {"bom": _serialize_bom(db, bom)}


@router.get("/bom/by-output/{output_item_id}")
def get_default_bom_for_output(
    output_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    bom = db.query(SteelBom).filter(
        SteelBom.factory_id == factory.factory_id,
        SteelBom.output_item_id == output_item_id,
        SteelBom.is_active.is_(True),
        SteelBom.is_default.is_(True),
    ).first()
    if not bom:
        raise HTTPException(status_code=404, detail="No default BOM found for this output item.")
    return {"bom": _serialize_bom(db, bom)}


@router.delete("/bom/{bom_id}")
def delete_steel_bom(
    bom_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="inventory.item.manage",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    bom = db.query(SteelBom).filter(SteelBom.id == bom_id, SteelBom.factory_id == factory.factory_id).first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found.")
    bom.is_active = False
    _write_steel_audit(db, actor=current_user, factory_id=factory.factory_id,
                       action="STEEL_BOM_DELETED", details=f"bom={bom.name}", request=request)
    db.commit()
    return {"message": "BOM deactivated."}


@router.post("/production/batches/auto-fill")
def create_batch_from_bom(
    payload: SteelBatchBomFillRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Create a production batch auto-filled from a BOM."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    bom = db.query(SteelBom).filter(
        SteelBom.id == payload.bom_id,
        SteelBom.factory_id == factory.factory_id,
        SteelBom.is_active.is_(True),
    ).first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found or inactive.")

    lines = db.query(SteelBomLine).filter(SteelBomLine.bom_id == bom.id).all()
    if not lines:
        raise HTTPException(status_code=400, detail="BOM has no lines.")

    output_item = _get_item_or_404(db, factory_id=factory.factory_id, item_id=bom.output_item_id)
    output_qty = payload.output_quantity_kg
    scale_factor = output_qty / float(bom.output_quantity_kg) if bom.output_quantity_kg > 0 else 1.0

    production_date = datetime.strptime(payload.production_date, "%Y-%m-%d").date()

    total_input_kg = 0.0
    input_items = []
    for line in lines:
        input_item = _get_item_or_404(db, factory_id=factory.factory_id, item_id=line.item_id)
        required_qty = round(float(line.ratio_kg) * scale_factor, 3)
        total_input_kg += required_qty
        input_items.append({"item": input_item, "required_qty": required_qty})

    warnings = []
    for entry in input_items:
        balance = locked_stock_balance_for_item(db, factory.factory_id, entry["item"].id)
        if balance < entry["required_qty"] - 0.001:
            warnings.append(
                f"Low stock for {entry['item'].item_code}: "
                f"{round(balance, 3)} kg available, {round(entry['required_qty'], 3)} kg required."
            )

    expected_output = output_qty
    loss_kg = max(0.0, total_input_kg - expected_output)
    loss_percent = round((loss_kg / total_input_kg) * 100.0, 3) if total_input_kg > 0 else 0.0
    variance_kg = expected_output - output_qty
    variance_percent = round((variance_kg / expected_output) * 100.0, 3) if expected_output > 0 else 0.0
    input_rates = [float(i["item"].current_rate_per_kg or 0.0) for i in input_items]
    max_rate = max(input_rates) if input_rates else 0.0
    variance_value_inr = round(variance_kg * max(max_rate, float(output_item.current_rate_per_kg or 0.0)), 2)

    batch_code = payload.batch_code or generate_batch_code(db, factory, when=datetime.now(timezone.utc))

    batch = SteelProductionBatch(
        org_id=factory.org_id,
        factory_id=factory.factory_id,
        batch_code=batch_code,
        production_date=production_date,
        input_item_id=input_items[0]["item"].id if input_items else output_item.id,
        output_item_id=output_item.id,
        operator_user_id=current_user.id,
        created_by_user_id=current_user.id,
        input_quantity_kg=total_input_kg,
        expected_output_kg=expected_output,
        actual_output_kg=payload.actual_output_kg,
        loss_kg=loss_kg,
        loss_percent=loss_percent,
        variance_kg=variance_kg,
        variance_percent=variance_percent,
        variance_value_inr=variance_value_inr,
        severity=severity_from_variance(variance_percent),
        notes=sanitize_text(payload.notes, max_length=500),
    )
    db.add(batch)
    db.flush()

    _write_steel_audit(
        db, actor=current_user, factory_id=factory.factory_id,
        action="STEEL_BATCH_CREATED_FROM_BOM",
        details=f"bom={bom.name} batch={batch_code} output={output_item.item_code} qty={output_qty}kg",
        request=request,
    )
    db.commit()
    db.refresh(batch)

    return {
        "batch": serialize_batch(
            batch,
            input_item=input_items[0]["item"] if input_items else None,
            output_item=output_item,
            operator=current_user,
        ),
        "warnings": warnings,
        "bom_info": {
            "bom_id": bom.id,
            "bom_name": bom.name,
            "scale_factor": round(scale_factor, 4),
            "input_items": [
                {"item_code": e["item"].item_code, "required_kg": e["required_qty"]}
                for e in input_items
            ],
        },
    }
