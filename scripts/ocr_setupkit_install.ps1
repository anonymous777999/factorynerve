param(
    [string]$InstallerPath = "",
    [string]$Language = "both"
)

Write-Host "DPR.ai OCR Setup Kit (Windows)"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$installer = $InstallerPath
if (-not $installer) {
    $candidate = Join-Path $scriptDir "tesseract-ocr-w64-setup.exe"
    if (Test-Path $candidate) { $installer = $candidate }
}

& (Join-Path $scriptDir "ocr_install_windows.ps1") -InstallerPath $installer
& (Join-Path $scriptDir "ocr_lang_windows.ps1") -Language $Language
& (Join-Path $scriptDir "ocr_verify.ps1")