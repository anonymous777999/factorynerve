"""OCR service wrapper around the OCR pipeline."""

from __future__ import annotations

from backend.ai.models.results import OCRResult
from backend.ai.pipelines.ocr_pipeline import OCRPipeline


class OCRService:
    def __init__(self, pipeline: OCRPipeline) -> None:
        self.pipeline = pipeline

    async def extract(self, document_text: str, extraction_schema: dict, org_id: int) -> OCRResult:
        return await self.pipeline.run(document_text=document_text, extraction_schema=extraction_schema, org_id=org_id)
