"""Central prompt registry for the AI service layer."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.ai.prompts.base import PromptTemplate, RenderedPrompt


PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"


class PromptRegistry:
    def __init__(self) -> None:
        self._templates = {
            "ocr_extraction": PromptTemplate(
                name="ocr_extraction",
                template=(
                    "Extract fields from the OCR text and respond with JSON only.\n"
                    "Schema:\n{extraction_schema}\n\n"
                    "Document text:\n{document_text}"
                ),
                description="Structured OCR extraction prompt.",
                version="v1",
            ),
            "smart_input_parse": PromptTemplate(
                name="smart_input_parse",
                template=(
                    "Extract DPR fields from the text and return JSON only.\n"
                    "Required schema:\n{expected_schema}\n\n"
                    "Input text:\n{document_text}"
                ),
                description="Smart-input parser prompt.",
                version="v1",
            ),
            "entry_summary": PromptTemplate(
                name="entry_summary",
                template=(
                    "You are a factory operations analyst. Write a concise shift summary in 3-5 sentences.\n"
                    "Use the structured entry data exactly.\n\n"
                    "Entry:\n{entry_payload}"
                ),
                description="Entry summary prompt.",
                version="v1",
            ),
        }

    def render(self, name: str, variables: dict[str, Any]) -> RenderedPrompt:
        external_path = PROMPTS_DIR / f"{name}.txt"
        template = self._templates.get(name)
        if external_path.exists():
            template = PromptTemplate(
                name=name,
                template=external_path.read_text(encoding="utf-8").strip(),
                description=template.description if template is not None else "",
                version=template.version if template is not None else "v1",
            )
        if template is None:
            raise KeyError(f"Prompt template '{name}' is not registered.")
        return RenderedPrompt(
            name=template.name,
            prompt_text=template.template.format(**variables),
            version=template.version,
            variables=dict(variables),
            metadata={},
        )
