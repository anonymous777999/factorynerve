from __future__ import annotations

import ast
import json
import logging
import os
from datetime import datetime
from io import BytesIO
from typing import Any

from anthropic import Anthropic
import requests
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from backend.ledger_scan import preprocess_image_bytes

logger = logging.getLogger(__name__)

BYTEZ_API_BASE = "https://api.bytez.com/models/v2"
BYTEZ_DEFAULT_MODEL = "google/gemma-7b"

SYSTEM_PROMPT = (
    "You are a document table extraction expert.\n"
    "Your job is to extract a table from an image into strict JSON format.\n\n"
    "RULES YOU MUST FOLLOW:\n"
    "- Return ONLY valid JSON, no explanation, no markdown, no backticks\n"
    "- The JSON must be an object with two keys: \"headers\" and \"rows\"\n"
    "- \"headers\" must be an array of strings (column names)\n"
    "- \"rows\" must be an array of arrays (each row aligns to headers)\n"
    "- If a header row is missing, infer short headers like \"Column 1\", \"Column 2\"\n"
    "- If a cell is empty or blank, use null\n"
    "- Do NOT skip any rows from the image\n"
    "- Do NOT add rows that don't exist in the image\n"
    "- Preserve the exact text and order from the image cells\n"
    "- Ensure every row has the same number of columns as headers (pad with nulls)\n"
    "\n"
    "Example output:\n"
    "{\n"
    "  \"headers\": [\"Name\", \"ID\", \"Fee\"],\n"
    "  \"rows\": [\n"
    "    [\"Amit\", \"S-102\", \"12000\"],\n"
    "    [\"Sara\", \"S-103\", \"15000\"]\n"
    "  ]\n"
    "}"
)

USER_MESSAGE = "Extract the table from this image into JSON following the rules exactly."

RETRY_MESSAGE = (
    "Your previous response was not valid JSON. "
    "Return ONLY the JSON object with headers and rows, nothing else."
)

HEADER_FILL = PatternFill("solid", fgColor="1F3864")
HEADER_FONT = Font(name="Arial", size=11, bold=True, color="FFFFFF")
HEADER_ALIGN = Alignment(horizontal="center", vertical="center")

TEXT_FONT = Font(name="Arial", size=10)
TEXT_ALIGN = Alignment(horizontal="left", vertical="center", wrap_text=True)



def _get_client() -> Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set in the environment.")
    return Anthropic(api_key=api_key)


def _table_scan_provider() -> str:
    return (os.getenv("TABLE_SCAN_PROVIDER") or os.getenv("LEDGER_SCAN_PROVIDER") or "anthropic").strip().lower()


def _normalize_provider(provider: str | None) -> str:
    key = (provider or "").strip().lower()
    if key in {"claude", "anthropic"}:
        return "anthropic"
    if key == "bytez":
        return "bytez"
    return ""


def _table_scan_provider_chain(primary: str | None) -> list[str]:
    chain_env = os.getenv("TABLE_SCAN_PROVIDER_CHAIN")
    if chain_env:
        raw = [item.strip() for item in chain_env.split(",")]
        seen: set[str] = set()
        chain: list[str] = []
        for item in raw:
            normalized = _normalize_provider(item)
            if normalized and normalized not in seen:
                chain.append(normalized)
                seen.add(normalized)
        if chain:
            return chain
    first = _normalize_provider(primary) or "anthropic"
    fallback = "bytez" if first == "anthropic" else "anthropic"
    return [first, fallback]


def _has_provider_key(provider: str) -> bool:
    if provider == "anthropic":
        return bool((os.getenv("ANTHROPIC_API_KEY") or "").strip())
    if provider == "bytez":
        return bool((os.getenv("BYTEZ_API_KEY") or "").strip())
    return False


def _bytez_auth_header(api_key: str) -> str:
    lowered = api_key.lower()
    if lowered.startswith("key ") or lowered.startswith("bearer "):
        return api_key
    return api_key


def _resolve_prompts(system_prompt: str | None, user_message: str | None) -> tuple[str, str]:
    if system_prompt is None:
        system_prompt = os.getenv("TABLE_SCAN_SYSTEM_PROMPT") or SYSTEM_PROMPT
    if user_message is None:
        user_message = os.getenv("TABLE_SCAN_USER_MESSAGE") or USER_MESSAGE
    return system_prompt, user_message


def _call_bytez(base64_image: str, *, system_prompt: str, user_message: str) -> Any:
    api_key = os.getenv("BYTEZ_API_KEY")
    if not api_key:
        raise RuntimeError("BYTEZ_API_KEY is not set in the environment.")

    model_id = (
        os.getenv("TABLE_SCAN_MODEL_ID")
        or os.getenv("BYTEZ_MODEL_ID")
        or BYTEZ_DEFAULT_MODEL
    ).strip() or BYTEZ_DEFAULT_MODEL
    provider_key = os.getenv("TABLE_SCAN_PROVIDER_KEY") or os.getenv("BYTEZ_PROVIDER_KEY")

    headers = {
        "Authorization": _bytez_auth_header(api_key),
        "Content-Type": "application/json",
    }
    if provider_key:
        headers["provider-key"] = provider_key

    image_url = os.getenv("BYTEZ_IMAGE_URL")
    if image_url:
        image_url = image_url.strip()
    if image_url and not image_url.lower().startswith(("http://", "https://")):
        logger.warning("BYTEZ_IMAGE_URL ignored (must start with http/https).")
        image_url = None
    if image_url:
        image_kind = "url"
        payload_mode = "content_blocks_url"
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_message},
                        {"type": "image", "url": image_url},
                    ],
                },
            ],
            "stream": False,
            "params": {"temperature": 0, "max_length": 2048},
        }
    else:
        image_kind = "base64"
        payload_mode = "top_level_base64_with_messages"
        combined_text = f"{system_prompt}\n\n{user_message}"
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": combined_text},
            ],
            "text": combined_text,
            "base64": base64_image,
            "stream": False,
            "params": {"temperature": 0, "max_length": 2048},
        }

    logger.info(
        "TableScan Bytez request: model=%s image_kind=%s payload_mode=%s base64_len=%s has_provider_key=%s",
        model_id,
        image_kind,
        payload_mode,
        len(base64_image) if image_kind == "base64" else "n/a",
        bool(provider_key),
    )

    response = requests.post(f"{BYTEZ_API_BASE}/{model_id}", headers=headers, json=payload, timeout=180)
    if response.status_code >= 400:
        raise RuntimeError(f"Bytez request failed ({response.status_code}): {response.text}")
    data = response.json()
    error = data.get("error")
    if error:
        raise RuntimeError(f"Bytez error: {error}")
    return data.get("output")


def _extract_text_from_bytez_output(output: Any) -> str | None:
    if not isinstance(output, dict):
        return None
    content = output.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text")
                if isinstance(text, str):
                    parts.append(text)
        if parts:
            return "".join(parts)
    text = output.get("text")
    if isinstance(text, str):
        return text
    return None


def _extract_text(response) -> str:
    parts = []
    for block in getattr(response, "content", []) or []:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    if not parts and hasattr(response, "content"):
        raw = response.content
        if isinstance(raw, str):
            parts.append(raw)
    return "".join(parts).strip()


def _call_claude(
    base64_image: str,
    *,
    system_prompt: str,
    user_message: str,
    extra_message: str | None = None,
) -> str:
    client = _get_client()
    text_message = user_message
    if extra_message:
        text_message = f"{user_message}\n\n{extra_message}"

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        temperature=0,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": text_message},
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": base64_image,
                        },
                    },
                ],
            }
        ],
    )
    return _extract_text(response)


def _normalize_table(data: Any) -> dict | None:
    if not isinstance(data, dict):
        return None

    headers = data.get("headers")
    rows = data.get("rows")
    if not isinstance(rows, list):
        return None

    if not isinstance(headers, list):
        headers = []
    headers = ["" if h is None else str(h).strip() for h in headers]

    normalized_rows: list[list[Any]] = []
    max_cols = len(headers)

    for row in rows:
        if isinstance(row, dict) and headers:
            row_list = [row.get(header) for header in headers]
        elif isinstance(row, list):
            row_list = row
        else:
            row_list = [row]

        normalized_rows.append(row_list)
        max_cols = max(max_cols, len(row_list))

    if max_cols == 0:
        return {"headers": [], "rows": []}

    if len(headers) < max_cols:
        headers.extend([f"Column {index}" for index in range(len(headers) + 1, max_cols + 1)])

    for index, header in enumerate(headers):
        if not header:
            headers[index] = f"Column {index + 1}"

    final_rows: list[list[Any]] = []
    for row in normalized_rows:
        if len(row) < max_cols:
            row = row + [None] * (max_cols - len(row))
        elif len(row) > max_cols:
            row = row[:max_cols]

        cleaned: list[Any] = []
        for cell in row:
            if cell is None:
                cleaned.append(None)
            elif isinstance(cell, (int, float, bool)):
                cleaned.append(cell)
            elif isinstance(cell, (dict, list)):
                cleaned.append(json.dumps(cell, ensure_ascii=False))
            else:
                cleaned.append(str(cell).strip())
        final_rows.append(cleaned)

    return {"headers": headers, "rows": final_rows}


def _extract_json_candidate(raw: str) -> Any | None:
    if not raw:
        return None
    raw = raw.strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    try:
        return ast.literal_eval(raw)
    except (ValueError, SyntaxError):
        pass

    for opener, closer in (("[", "]"), ("{", "}")):
        depth = 0
        start_idx: int | None = None
        for idx, ch in enumerate(raw):
            if ch == opener:
                if depth == 0:
                    start_idx = idx
                depth += 1
            elif ch == closer and depth > 0:
                depth -= 1
                if depth == 0 and start_idx is not None:
                    candidate = raw[start_idx : idx + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        try:
                            return ast.literal_eval(candidate)
                        except (ValueError, SyntaxError):
                            start_idx = None
        # try next opener
    return None


def extract_table_from_image(
    image_bytes: bytes,
    *,
    system_prompt: str | None = None,
    user_message: str | None = None,
    preprocess_profile: str | None = None,
) -> dict:
    profile = (
        preprocess_profile
        or os.getenv("TABLE_SCAN_PREPROCESS_PROFILE")
        or os.getenv("IMAGE_PREPROCESS_PROFILE")
    )
    base64_image = preprocess_image_bytes(image_bytes, profile=profile)
    system_prompt, user_message = _resolve_prompts(system_prompt, user_message)
    providers = _table_scan_provider_chain(_table_scan_provider())
    failures: list[str] = []
    last_error: Exception | None = None

    def _run_provider(provider: str) -> dict:
        if provider == "bytez":
            output = _call_bytez(base64_image, system_prompt=system_prompt, user_message=user_message)
            table = _normalize_table(output)
            if table is not None:
                return table

            raw = _extract_text_from_bytez_output(output)
            if raw is None:
                raw = output if isinstance(output, str) else json.dumps(output)
        else:
            raw = _call_claude(base64_image, system_prompt=system_prompt, user_message=user_message)

        parsed = _extract_json_candidate(raw)
        table = _normalize_table(parsed) if parsed is not None else None
        if table is not None:
            return table
        if parsed is not None:
            raise ValueError("AI response JSON did not match the expected table schema.")

        if provider == "bytez":
            output = _call_bytez(base64_image, system_prompt=system_prompt, user_message=user_message)
            table = _normalize_table(output)
            if table is not None:
                return table
            raw = _extract_text_from_bytez_output(output)
            if raw is None:
                raw = output if isinstance(output, str) else json.dumps(output)
        else:
            raw = _call_claude(
                base64_image,
                system_prompt=system_prompt,
                user_message=user_message,
                extra_message=RETRY_MESSAGE,
            )

        parsed = _extract_json_candidate(raw)
        table = _normalize_table(parsed) if parsed is not None else None
        if table is None:
            if parsed is not None:
                raise ValueError("AI response JSON did not match the expected table schema after retry.")
            raise ValueError("AI response was not valid JSON after retry.")

        return table

    for provider in providers:
        if not _has_provider_key(provider):
            logger.warning("TableScan provider %s skipped (missing API key).", provider)
            failures.append(f"{provider}:missing_key")
            continue
        try:
            table = _run_provider(provider)
            if failures:
                logger.info("TableScan fallback succeeded with %s after %s", provider, failures)
            return table
        except Exception as error:  # pylint: disable=broad-except
            last_error = error
            logger.warning("TableScan provider failed (%s): %s", provider, error)
            failures.append(provider)

    if last_error:
        raise ValueError(f"TableScan failed for providers: {', '.join(failures)}") from last_error
    raise ValueError("TableScan failed: no available providers.")


def build_table_excel_bytes(table: dict) -> bytes:
    headers = table.get("headers", [])
    rows = table.get("rows", [])

    wb = Workbook()
    ws = wb.active
    ws.title = "Table"

    for col_index, header in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_index, value=header)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = HEADER_ALIGN

    for row_index, row in enumerate(rows, start=2):
        for col_index, value in enumerate(row, start=1):
            cell = ws.cell(row=row_index, column=col_index, value=value if value is not None else "")
            cell.font = TEXT_FONT
            cell.alignment = TEXT_ALIGN

    column_widths = [len(str(header)) for header in headers]
    for row in rows:
        for index, value in enumerate(row):
            text = "" if value is None else str(value)
            column_widths[index] = max(column_widths[index], len(text))

    for index, width in enumerate(column_widths, start=1):
        ws.column_dimensions[get_column_letter(index)].width = min(max(width + 2, 10), 60)

    summary = wb.create_sheet("Summary")
    summary["A1"] = "Extraction timestamp"
    summary["B1"] = datetime.now().isoformat(timespec="seconds")
    summary["A2"] = "Total rows extracted"
    summary["B2"] = len(rows)
    summary["A3"] = "Total columns"
    summary["B3"] = len(headers)

    for row in range(1, 4):
        summary[f"A{row}"].font = Font(name="Arial", size=10, bold=True)
        summary[f"B{row}"].font = Font(name="Arial", size=10)

    summary.column_dimensions["A"].width = 28
    summary.column_dimensions["B"].width = 32

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
