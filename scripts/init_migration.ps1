param(
  [string]$DatabaseUrl = "sqlite:///dpr_ai_bootstrap.db",
  [string]$Message = "initial_schema"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Error "Python not found on PATH."
}

# Check alembic availability
$alembicOk = $false
try {
  python - <<'PY'
import importlib.util
print("ok" if importlib.util.find_spec("alembic") else "missing")
PY
  $alembicOk = $true
} catch {
  $alembicOk = $false
}

if (-not $alembicOk) {
  Write-Error "Alembic is not installed. Run: pip install -r requirements.txt"
}

$env:DATABASE_URL = $DatabaseUrl
Write-Host "DATABASE_URL=$DatabaseUrl"
python -m alembic revision --autogenerate -m $Message
