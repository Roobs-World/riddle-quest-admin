$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$localEnvPath = Join-Path $projectRoot ".env.browserstack.local"

function Fail($message) {
  [Console]::Error.WriteLine("[browserstack-mcp] $message")
  exit 1
}

function Import-DotEnvFile($path) {
  if (-not (Test-Path -LiteralPath $path)) {
    return
  }

  Get-Content -LiteralPath $path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      return
    }

    $parts = $line -split "=", 2
    if ($parts.Count -ne 2) {
      return
    }

    $name = $parts[0].Trim()
    if ($name -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
      return
    }

    $value = $parts[1].Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

Import-DotEnvFile $localEnvPath

if (-not $env:BROWSERSTACK_USERNAME -or -not $env:BROWSERSTACK_ACCESS_KEY) {
  Fail "Credentials are missing. Set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY in your environment or create $localEnvPath from .env.browserstack.local.example."
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Fail "Node.js is required to run @browserstack/mcp-server. Install Node >= 18."
}

$nodeVersion = & $nodeCommand.Source --version
if ($LASTEXITCODE -ne 0 -or -not $nodeVersion) {
  Fail "Node.js is required to run @browserstack/mcp-server. Install Node >= 18."
}

$nodeMajor = [int]($nodeVersion -replace "^v(\d+).*$", '$1')
if ($nodeMajor -lt 18) {
  Fail "BrowserStack MCP requires Node >= 18. Current version: $nodeVersion."
}

if (-not $env:npm_config_loglevel) {
  $env:npm_config_loglevel = "error"
}

# BrowserStack's production logger writes to a relative "NUL" path on Windows.
$env:NODE_ENV = "development"

& npx --loglevel=error -y @browserstack/mcp-server@latest
exit $LASTEXITCODE
