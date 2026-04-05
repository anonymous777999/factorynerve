Param(
    [string]$InputFile = "requirements.in",
    [string]$OutputFile = "requirements.txt"
)

$ErrorActionPreference = "Stop"

python -m pip install --upgrade pip pip-tools
pip-compile $InputFile --output-file $OutputFile

Write-Host "Pinned requirements written to $OutputFile"
