Write-Host "Building DPR.ai OCR Setup Kit..."

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$dist = Join-Path $root "dist"
$kit = Join-Path $dist "ocr_setupkit"

New-Item -ItemType Directory -Path $kit -Force | Out-Null

Copy-Item (Join-Path $root "scripts\ocr_install_windows.ps1") $kit -Force
Copy-Item (Join-Path $root "scripts\ocr_lang_windows.ps1") $kit -Force
Copy-Item (Join-Path $root "scripts\ocr_verify.ps1") $kit -Force
Copy-Item (Join-Path $root "scripts\ocr_setupkit_install.ps1") $kit -Force

$localInstaller = Get-ChildItem -Path $root -Filter "tesseract-ocr-w64-setup*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($localInstaller) {
    Copy-Item $localInstaller.FullName (Join-Path $kit "tesseract-ocr-w64-setup.exe") -Force
}

Write-Host "Setup kit ready: $kit"