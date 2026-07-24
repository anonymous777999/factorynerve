@echo off
title Claude Code — Forge AI Gateway

:: ── Forge AI Gateway Config ──
set ANTHROPIC_BASE_URL=https://forge-gateway-api.fly.dev/v1/
set ANTHROPIC_API_KEY=fg-e020d1f536df464399ef2cb69a5ae170
set ANTHROPIC_AUTH_TOKEN=fg-e020d1f536df464399ef2cb69a5ae170
set CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1
set CLAUDE_CODE_AUTO_COMPACT_WINDOW=190000

:: ── Launch Claude Code ──
echo 🚀 Launching Claude Code via Forge AI Gateway...
echo.
echo    Endpoint: %ANTHROPIC_BASE_URL%
echo    Model:    claude-sonnet-5
echo.
claude %*

:: ── Pause on error ──
if errorlevel 1 (
    echo.
    echo ⚠ Claude Code exited with code %errorlevel%
    pause
)
