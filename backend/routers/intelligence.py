"""Async endpoints for Factory Intelligence Engine orchestration."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from backend.ai_rate_limit import RateLimitError
from backend.database import get_db
from backend.models.user import User
from backend.security import get_current_user
from backend.services.intelligence import (
    enqueue_intelligence_request,
    get_intelligence_request_payload,
    list_intelligence_requests,
    summarize_user_intelligence_usage,
)


router = APIRouter(tags=["Factory Intelligence"])


@router.post("/requests", status_code=status.HTTP_202_ACCEPTED)
async def create_intelligence_request(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        file_bytes = await file.read()
        return enqueue_intelligence_request(
            db=db,
            current_user=current_user,
            filename=file.filename or "factory-intelligence-input.bin",
            content_type=file.content_type or "application/octet-stream",
            file_bytes=file_bytes,
        )
    except RateLimitError as error:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=error.detail) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    finally:
        await file.close()


@router.get("/requests")
def get_intelligence_requests(
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    return list_intelligence_requests(db=db, current_user=current_user, limit=limit)


@router.get("/requests/{request_id}")
def get_intelligence_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    payload = get_intelligence_request_payload(db=db, current_user=current_user, request_id=request_id)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factory Intelligence request not found.")
    return payload


@router.get("/usage")
def get_intelligence_usage(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return summarize_user_intelligence_usage(db=db, current_user=current_user, days=days)
