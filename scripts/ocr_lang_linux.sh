#!/usr/bin/env bash
set -e

LANGUAGE=${1:-both}

if ! command -v tesseract >/dev/null 2>&1; then
  echo "Install tesseract first."
  exit 1
fi

TESSDATA_DIR="$(tesseract --print-tessdata-dir 2>/dev/null || true)"
if [ -z "$TESSDATA_DIR" ]; then
  if [ -d "/usr/share/tesseract-ocr/4.00/tessdata" ]; then
    TESSDATA_DIR="/usr/share/tesseract-ocr/4.00/tessdata"
  else
    TESSDATA_DIR="/usr/share/tesseract-ocr/tessdata"
  fi
fi

mkdir -p "$TESSDATA_DIR"

url_eng="https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata"
url_hin="https://github.com/tesseract-ocr/tessdata_fast/raw/main/hin.traineddata"
url_mar="https://github.com/tesseract-ocr/tessdata_fast/raw/main/mar.traineddata"

download() {
  local url=$1
  local out=$2
  if [ -f "$out" ]; then
    echo "Already present: $out"
    return 0
  fi
  if command -v curl >/dev/null 2>&1; then
    curl -L -o "$out" "$url"
  else
    wget -O "$out" "$url"
  fi
}

case "$LANGUAGE" in
  eng) download "$url_eng" "$TESSDATA_DIR/eng.traineddata" ;; 
  hin) download "$url_hin" "$TESSDATA_DIR/hin.traineddata" ;; 
  mar) download "$url_mar" "$TESSDATA_DIR/mar.traineddata" ;; 
  both)
    download "$url_hin" "$TESSDATA_DIR/hin.traineddata"
    download "$url_mar" "$TESSDATA_DIR/mar.traineddata"
    ;;
  all)
    download "$url_eng" "$TESSDATA_DIR/eng.traineddata"
    download "$url_hin" "$TESSDATA_DIR/hin.traineddata"
    download "$url_mar" "$TESSDATA_DIR/mar.traineddata"
    ;;
  *) echo "Usage: $0 [eng|hin|mar|both|all]"; exit 1 ;;
 esac

echo "Installed languages in $TESSDATA_DIR"