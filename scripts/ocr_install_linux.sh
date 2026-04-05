#!/usr/bin/env bash
set -e

echo "DPR.ai OCR Setup (Linux)"

if command -v tesseract >/dev/null 2>&1; then
  echo "Tesseract already installed."
  tesseract --version || true
  exit 0
fi

if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y tesseract-ocr
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y tesseract
elif command -v yum >/dev/null 2>&1; then
  sudo yum install -y tesseract
else
  echo "No supported package manager found. Install tesseract manually."
  exit 1
fi

tesseract --version || true