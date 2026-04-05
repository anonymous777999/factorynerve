"""Generic background job endpoints for global UI polling."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.models.user import User
from backend.security import get_current_user
from backend.services.background_jobs import cancel_job, get_job, list_jobs, retry_job


router = APIRouter(tags=["Jobs"])


@router.get("")
def list_background_jobs(
    limit: int = Query(default=12, ge=1, le=50),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    return list_jobs(owner_id=current_user.id, limit=limit)


@router.get("/{job_id}")
def get_background_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    payload = get_job(job_id, owner_id=current_user.id)
    if not payload:
        raise HTTPException(status_code=404, detail="Job not found.")
    return payload


@router.post("/{job_id}/cancel")
def cancel_background_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        return cancel_job(job_id, owner_id=current_user.id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Job not found.") from error
    except PermissionError as error:
        raise HTTPException(status_code=403, detail="Access denied.") from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post("/{job_id}/retry")
def retry_background_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    payload = get_job(job_id, owner_id=current_user.id)
    if not payload:
        raise HTTPException(status_code=404, detail="Job not found.")
    try:
        return retry_job(job_id, owner_id=current_user.id)
    except PermissionError as error:
        raise HTTPException(status_code=403, detail="Access denied.") from error
    except LookupError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except KeyError as error:
        raise HTTPException(status_code=400, detail=f"Retry payload is missing {error}.") from error
