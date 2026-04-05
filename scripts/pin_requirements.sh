#!/usr/bin/env bash
set -euo pipefail

INPUT_FILE="${1:-requirements.in}"
OUTPUT_FILE="${2:-requirements.txt}"

python -m pip install --upgrade pip pip-tools
pip-compile "$INPUT_FILE" --output-file "$OUTPUT_FILE"

echo "Pinned requirements written to $OUTPUT_FILE"
