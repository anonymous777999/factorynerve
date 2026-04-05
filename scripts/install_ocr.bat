@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0ocr_install_windows.ps1"
powershell -ExecutionPolicy Bypass -File "%~dp0ocr_lang_windows.ps1" -Language both
powershell -ExecutionPolicy Bypass -File "%~dp0ocr_verify.ps1"
endlocal