param(
  [switch]$ConfigureCredentials,
  [string]$BuildProfile = "browserstack",
  [string]$OutputPath = "releases\qwordly-browserstack.ipa"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env.browserstack.local"
$resolvedOutputPath = Join-Path $projectRoot $OutputPath
$outputDirectory = Split-Path -Parent $resolvedOutputPath
$buildJsonPath = Join-Path $outputDirectory "eas-ios-browserstack-build.json"

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
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if ($name -match "^[A-Za-z_][A-Za-z0-9_]*$") {
      Set-Item "Env:\$name" $value
    }
  }
}

Set-Location $projectRoot
Import-DotEnvFile $envPath

if (-not $env:BROWSERSTACK_USERNAME -or -not $env:BROWSERSTACK_ACCESS_KEY) {
  throw "Set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY or create .env.browserstack.local."
}

if ($ConfigureCredentials) {
  & pnpm exec eas credentials:configure-build --platform ios --profile $BuildProfile
  if ($LASTEXITCODE -ne 0) {
    throw "EAS iOS credential configuration failed."
  }
}

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

& pnpm exec eas build --platform ios --profile $BuildProfile --wait --json |
  Set-Content -LiteralPath $buildJsonPath -Encoding utf8
if ($LASTEXITCODE -ne 0) {
  throw "EAS iOS build failed."
}

$buildData = Get-Content -LiteralPath $buildJsonPath -Raw | ConvertFrom-Json
$build = if ($buildData -is [array]) { $buildData[0] } else { $buildData }
$buildUrl = $build.artifacts.buildUrl
if (-not $buildUrl) {
  throw "EAS did not return an iOS build artifact URL."
}

Invoke-WebRequest -Uri $buildUrl -OutFile $resolvedOutputPath

$env:BROWSERSTACK_APP = $resolvedOutputPath
if (-not $env:BROWSERSTACK_BUILD_NAME) {
  $env:BROWSERSTACK_BUILD_NAME = "qwordly-ios-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}

& pnpm run test:ios:browserstack
if ($LASTEXITCODE -ne 0) {
  throw "BrowserStack iOS matrix failed."
}

Write-Host "PASS: BrowserStack iOS matrix completed."
