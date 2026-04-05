# DPR.ai OCR Setup Kit

Use this when installing OCR on client machines with minimal friction.

## Build the kit
Run:
```
powershell -ExecutionPolicy Bypass -File scripts/build_ocr_setupkit.ps1
```

## Install from kit (Windows)
1. Copy the kit folder to client PC.
2. Run:
```
powershell -ExecutionPolicy Bypass -File ocr_setupkit_install.ps1
```

The kit installs Tesseract, configures PATH, and adds Hindi/Marathi language packs.