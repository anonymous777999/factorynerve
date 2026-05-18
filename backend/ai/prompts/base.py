"""Prompt primitives for typed rendering."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class PromptTemplate:
    name: str
    template: str
    description: str = ""
    version: str = "v1"


@dataclass(slots=True)
class RenderedPrompt:
    name: str
    prompt_text: str
    version: str = "v1"
    variables: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
