param(
    [ValidateSet('eng','hin','mar','both','all')]
    [string]$Language = "both"
)

Write-Host "DPR.ai OCR Language Packs (Windows)"

function Find-TessdataDir {
    if ($env:TESSDATA_PREFIX) {
        $candidate = Join-Path $env:TESSDATA_PREFIX "tessdata"
        if (Test-Path $candidate) {
            return $candidate
        }
    }
    $default = "C:\Program Files\Tesseract-OCR\tessdata"
    if (Test-Path $default) { return $default }
    $fallback = "C:\Program Files (x86)\Tesseract-OCR\tessdata"
    if (Test-Path $fallback) { return $fallback }
    return $null
}

function Can-Write($dir) {
    try {
        $testFile = Join-Path $dir ".__dpr_write_test"
        New-Item -ItemType File -Path $testFile -Force | Out-Null
        Remove-Item $testFile -Force
        return $true
    } catch {
        return $false
    }
}

$tessData = Find-TessdataDir
if (-not $tessData) {
    Write-Host "Tessdata not found. Install Tesseract first."
    exit 1
}

$targetDir = $tessData
if (-not (Can-Write $tessData)) {
    $targetDir = Join-Path $env:LOCALAPPDATA "DPR.ai\tessdata"
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    $prefix = $targetDir
    [Environment]::SetEnvironmentVariable("TESSDATA_PREFIX", $prefix, "User")
    $env:TESSDATA_PREFIX = $prefix
    Write-Host "Using local tessdata: $targetDir"
}

# Copy eng/osd if target is local
if ($targetDir -ne $tessData) {
    foreach ($base in @("eng.traineddata", "osd.traineddata")) {
        $src = Join-Path $tessData $base
        $dst = Join-Path $targetDir $base
        if ((Test-Path $src) -and (-not (Test-Path $dst))) {
            Copy-Item $src $dst -Force
        }
    }
}

$urls = @{
    "eng" = "https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata"
    "hin" = "https://github.com/tesseract-ocr/tessdata_fast/raw/main/hin.traineddata"
    "mar" = "https://github.com/tesseract-ocr/tessdata_fast/raw/main/mar.traineddata"
}

$langs = @()
switch ($Language) {
    "eng" { $langs = @("eng") }
    "hin" { $langs = @("hin") }
    "mar" { $langs = @("mar") }
    "both" { $langs = @("hin", "mar") }
    "all" { $langs = @("eng", "hin", "mar") }
}

Write-Host "Installing language packs..."
foreach ($lang in $langs) {
    $outFile = Join-Path $targetDir "$lang.traineddata"
    if (Test-Path $outFile) {
        Write-Host "$lang already present."
        continue
    }
    Invoke-WebRequest -Uri $urls[$lang] -OutFile $outFile
    Write-Host "Installed $lang"
}

Write-Host "Language packs installed in $targetDir"