from __future__ import annotations

import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.ocr_utils import detect_column_centers
from backend.security import get_current_user
from backend.utils import sanitize_text

from backend.routers.ocr._common import (
    logger,
    router,
    _require_ocr_access,
    _log_ocr_event,
    _active_factory_id,
    _active_factory_name,
    _template_query,
    _require_templates_access,
    _read_validated_image_upload,
    _parse_json_list,
    _serialize_verification,
    _get_verification_or_404,
    OCR_VERIFICATION_DIR,
    _FILENAME_SAFE_RE,
)
from backend.authorization import PDP
from backend.models.ocr_template import OcrTemplate
from backend.models.factory import Factory
from backend.models.user import User

@router.get("/status", status_code=status.HTTP_200_OK)
def ocr_status() -> dict:
    tesseract_path = shutil.which("tesseract")
    if not tesseract_path:
        for path in (
            Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
            Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
        ):
            if path.exists():
                tesseract_path = str(path)
                break
    if not tesseract_path:
        return {"installed": False, "message": "Tesseract not found on PATH."}
    env = os.environ.copy()
    local_app = os.getenv("LOCALAPPDATA")
    if local_app:
        candidate = Path(local_app) / "DPR.ai" / "tessdata"
        if candidate.exists():
            env["TESSDATA_PREFIX"] = str(candidate)
    try:
        version = subprocess.check_output([tesseract_path, "--version"], text=True, env=env).splitlines()[0]
        langs_raw = subprocess.check_output([tesseract_path, "--list-langs"], text=True, env=env)
        langs = [line.strip() for line in langs_raw.splitlines() if line and ":" not in line]
    except Exception:  # pylint: disable=broad-except
        version = "unknown"
        langs = []
    return {
        "installed": True,
        "path": tesseract_path,
        "version": version,
        "tessdata_prefix": env.get("TESSDATA_PREFIX"),
        "languages": langs,
    }


@router.get("/templates", status_code=status.HTTP_200_OK)
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    _require_ocr_access(db, current_user)
    _require_templates_access(db, current_user)
    templates = (
        _template_query(db, current_user)
        .filter(OcrTemplate.is_active.is_(True))
        .order_by(OcrTemplate.created_at.desc())
        .all()
    )
    return [
        {
            "id": template.id,
            "name": template.name,
            "columns": template.columns,
            "header_mode": template.header_mode,
            "language": template.language,
            "column_names": template.column_names or [],
            "column_keywords": template.column_keywords or [],
            "raw_column_label": template.raw_column_label or "Raw",
            "enable_raw_column": template.enable_raw_column,
            "created_at": template.created_at.isoformat(),
        }
        for template in templates
    ]


@router.post("/templates", status_code=status.HTTP_201_CREATED)
async def create_template(
    name: str = Form(...),
    columns: int = Form(default=3),
    header_mode: str = Form(default="first"),
    language: str = Form(default="eng"),
    column_names: str | None = Form(default=None),
    column_keywords: str | None = Form(default=None),
    raw_column_label: str | None = Form(default="Raw"),
    enable_raw_column: bool = Form(default=True),
    samples: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    PDP(db=db).require_permission(actor=current_user, permission_key="ocr.template.manage")
    if not samples:
        raise HTTPException(status_code=400, detail="Sample images are required.")
    if columns < 1 or columns > 8:
        raise HTTPException(status_code=400, detail="Columns must be between 1 and 8.")

    sample_bytes: list[bytes] = []
    for file in samples:
        sample_bytes.append(await _read_validated_image_upload(file))

    parsed_names = _parse_json_list(column_names)
    parsed_keywords = _parse_json_list(column_keywords)

    try:
        centers, avg_conf, warnings = detect_column_centers(sample_bytes, columns=columns, language=language)
    except RuntimeError as error:
        logger.exception("Template analysis failed.")
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # pylint: disable=broad-except
        logger.exception("Template analysis failed.")
        raise HTTPException(status_code=500, detail="Template analysis failed. Please verify OCR setup.") from error
    factory_id = _active_factory_id(db, current_user)
    if not factory_id:
        raise HTTPException(status_code=400, detail="Factory must be selected before creating templates.")
    template = OcrTemplate(
        factory_id=factory_id,
        factory_name=_active_factory_name(db, current_user),
        name=name.strip(),
        columns=columns,
        header_mode=header_mode,
        language=language,
        column_names=parsed_names,
        column_keywords=parsed_keywords,
        column_centers=centers,
        raw_column_label=raw_column_label or "Raw",
        enable_raw_column=enable_raw_column,
        created_by=current_user.id,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return {
        "id": template.id,
        "avg_confidence": avg_conf,
        "warnings": warnings,
        "template": {
            "id": template.id,
            "name": template.name,
            "columns": template.columns,
            "header_mode": template.header_mode,
            "language": template.language,
            "column_names": template.column_names or [],
            "column_keywords": template.column_keywords or [],
            "raw_column_label": template.raw_column_label or "Raw",
            "enable_raw_column": template.enable_raw_column,
        },
    }


@router.delete("/templates/{template_id}", status_code=status.HTTP_200_OK)
def deactivate_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    PDP(db=db).require_permission(actor=current_user, permission_key="ocr.template.manage")
    template = (
        _template_query(db, current_user)
        .filter(OcrTemplate.id == template_id, OcrTemplate.is_active.is_(True))
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found.")
    template.is_active = False
    template.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Template archived."}

