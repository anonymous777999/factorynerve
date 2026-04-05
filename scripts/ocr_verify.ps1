Write-Host "DPR.ai OCR Verify"

$exe = $null
$paths = @(
  "C:\Program Files\Tesseract-OCR\tesseract.exe",
  "C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"
)
foreach ($p in $paths) {
  if (Test-Path $p) { $exe = $p }
}
if (-not $exe) {
  $cmd = Get-Command tesseract -ErrorAction SilentlyContinue
  if ($cmd) { $exe = $cmd.Source }
}

if (-not $exe) {
  Write-Host "Tesseract not found."
  exit 1
}

Write-Host "Tesseract: $exe"
& $exe --version
& $exe --list-langs

if ($env:TESSDATA_PREFIX) {
  Write-Host "TESSDATA_PREFIX: $env:TESSDATA_PREFIX"
}