# DPR.ai OCR Setup (Windows + Linux)

This guide helps you enable OCR for logbook images.

## Windows (Recommended)
1. Install OCR engine:
   - Run: `powershell -ExecutionPolicy Bypass -File scripts/ocr_install_windows.ps1`
2. Install language packs (Hindi/Marathi):
   - Run: `powershell -ExecutionPolicy Bypass -File scripts/ocr_lang_windows.ps1 -Language both`
3. Verify:
   - Run: `powershell -ExecutionPolicy Bypass -File scripts/ocr_verify.ps1`

## Linux
1. Install OCR engine:
   - Run: `bash scripts/ocr_install_linux.sh`
2. Install language packs:
   - Run: `bash scripts/ocr_lang_linux.sh both`
3. Verify:
   - Run: `tesseract --list-langs`

If you get permission errors on Windows, the scripts automatically switch to a local tessdata folder under:
`%LOCALAPPDATA%\DPR.ai\tessdata` and set `TESSDATA_PREFIX` for you.