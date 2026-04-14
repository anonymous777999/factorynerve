param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Status {
  param(
    [string]$Label,
    [string]$State,
    [string]$Detail
  )

  "{0,-18} {1,-10} {2}" -f $Label, $State, $Detail
}

function Test-CommandExists {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-EnvValue {
  param([string]$Name)

  $processValue = [System.Environment]::GetEnvironmentVariable($Name, "Process")
  if ($processValue) {
    return $processValue
  }

  $userValue = [System.Environment]::GetEnvironmentVariable($Name, "User")
  if ($userValue) {
    return $userValue
  }

  return $null
}

function Invoke-Capture {
  param(
    [string]$Command,
    [string]$WorkingDirectory = $RepoRoot
  )

  Push-Location $WorkingDirectory
  try {
    $output = & powershell -NoProfile -Command $Command 2>&1
    return @{
      ExitCode = $LASTEXITCODE
      Output = ($output -join [Environment]::NewLine)
    }
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "FactoryNerve Codex integration readiness"
Write-Host "Repo root: $RepoRoot"
Write-Host ""

$vercelMcp = Invoke-Capture -Command "codex mcp get vercel --json" -WorkingDirectory $RepoRoot
if ($vercelMcp.ExitCode -eq 0) {
  Write-Host (Write-Status -Label "Vercel MCP" -State "ready" -Detail "Configured in Codex global config.")
} else {
  Write-Host (Write-Status -Label "Vercel MCP" -State "missing" -Detail "Run: codex mcp add vercel --url https://mcp.vercel.com")
}

if (Test-CommandExists "gh") {
  $ghStatus = Invoke-Capture -Command "gh auth status" -WorkingDirectory $RepoRoot
  if ($ghStatus.ExitCode -eq 0) {
    $firstLine = ($ghStatus.Output -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 1)
    Write-Host (Write-Status -Label "GitHub" -State "ready" -Detail $firstLine)
  } else {
    Write-Host (Write-Status -Label "GitHub" -State "missing" -Detail "Run: gh auth login")
  }
} else {
  Write-Host (Write-Status -Label "GitHub" -State "missing" -Detail "`gh` is not installed.")
}

$webDir = Join-Path $RepoRoot "web"
if (Test-Path $webDir) {
  $vercelWhoAmI = Invoke-Capture -Command "npx vercel whoami" -WorkingDirectory $webDir
  if ($vercelWhoAmI.ExitCode -eq 0) {
    $identity = ($vercelWhoAmI.Output -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 1)
    Write-Host (Write-Status -Label "Vercel CLI" -State "ready" -Detail "Logged in as $identity")
  } else {
    Write-Host (Write-Status -Label "Vercel CLI" -State "missing" -Detail "Run: npx vercel login")
  }
} else {
  Write-Host (Write-Status -Label "Vercel CLI" -State "skip" -Detail "No web/ directory found.")
}

$figmaToken = Get-EnvValue "FIGMA_ACCESS_TOKEN"
if (-not $figmaToken) {
  $figmaToken = Get-EnvValue "FIGMA_TOKEN"
}
$figmaPluginDir = "C:\Users\shubh\.codex\.tmp\plugins\plugins\figma"
if ($figmaToken) {
  Write-Host (Write-Status -Label "Figma" -State "partial" -Detail "Local token detected. Provide file and frame links in prompts.")
} elseif (Test-Path $figmaPluginDir) {
  Write-Host (Write-Status -Label "Figma" -State "pending" -Detail "Plugin bundle exists, but no local token detected on this machine.")
} else {
  Write-Host (Write-Status -Label "Figma" -State "missing" -Detail "Plugin bundle not found in the local Codex marketplace.")
}

$sentryToken = Get-EnvValue "SENTRY_AUTH_TOKEN"
$sentryOrg = Get-EnvValue "SENTRY_ORG"
$sentryProject = Get-EnvValue "SENTRY_PROJECT"
if ($sentryToken -and $sentryOrg -and $sentryProject) {
  Write-Host (Write-Status -Label "Sentry" -State "ready" -Detail "Token and defaults are present.")
} elseif ($sentryToken) {
  Write-Host (Write-Status -Label "Sentry" -State "partial" -Detail "Token exists, but SENTRY_ORG or SENTRY_PROJECT is missing.")
} else {
  Write-Host (Write-Status -Label "Sentry" -State "missing" -Detail "Set SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT locally.")
}

Write-Host ""
Write-Host "Recommended UI shipping flow"
Write-Host "1. Figma link or frame -> 2. local code -> 3. GitHub context -> 4. local checks -> 5. Vercel verify -> 6. Sentry check"
Write-Host ""
