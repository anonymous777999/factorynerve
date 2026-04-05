param(
    [string]$InstallerPath = ""
)

Write-Host "DPR.ai OCR Setup (Windows)"

function Find-Tesseract {
    $paths = @(
        "C:\Program Files\Tesseract-OCR\tesseract.exe",
        "C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"
    )
    foreach ($path in $paths) {
        if (Test-Path $path) {
            return $path
        }
    }
    $cmd = Get-Command tesseract -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }
    return $null
}

$tesseractExe = Find-Tesseract
if ($tesseractExe) {
    Write-Host "Tesseract already installed at $tesseractExe"
} else {
    if ($InstallerPath -and (Test-Path $InstallerPath)) {
        Write-Host "Running manual installer: $InstallerPath"
        Start-Process -FilePath $InstallerPath -Wait
    } else {
        $winget = Get-Command winget -ErrorAction SilentlyContinue
        if ($winget) {
            Write-Host "Installing Tesseract via winget..."
            winget install --id UB-Mannheim.TesseractOCR -e --source winget
        } else {
            Write-Host "Winget not found. Please install Tesseract manually."
        }
    }
}

$tesseractExe = Find-Tesseract
if (-not $tesseractExe) {
    Write-Host "Tesseract installation finished, but command not found."
    Write-Host "Please restart terminal or ensure Tesseract is in PATH."
    exit 1
}

$tessDir = Split-Path $tesseractExe -Parent
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$tessDir*") {
    [Environment]::SetEnvironmentVariable("Path", ($userPath + ";" + $tessDir).Trim(';'), "User")
    $env:Path = $env:Path + ";" + $tessDir
    Write-Host "Added Tesseract to user PATH. Restart terminal to use 'tesseract' command."
}

& $tesseractExe --version