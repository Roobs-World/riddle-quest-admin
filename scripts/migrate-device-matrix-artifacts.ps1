param(
  [string]$DeviceName = "legacy"
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot\device-matrix-artifacts.ps1"

$workspaceRoot = (Resolve-Path ".").Path
$archiveRoot = Get-DeviceMatrixArchiveRoot $workspaceRoot
$targetDevice = ConvertTo-ArchiveSegment $DeviceName

$sourceFiles = @(Get-ChildItem -Path $workspaceRoot -File -Force | Where-Object {
  $name = $_.Name

  if ($name -match '^(AGENTS|app\.config|babel\.config|eas|firebase|global|google-services|index|jest|metro|nativewind-env|package|pnpm-lock|pnpm-workspace|react-native\.config|readme|skills-lock|tailwind|tsconfig)\.') {
    return $false
  }

  if ($name.StartsWith(".")) {
    return $false
  }

  return $name -match '\.(png|jpe?g|xml|txt|log|csv|json)$'
})

if (-not $sourceFiles) {
  Write-Host "No root-level device matrix artifacts found to migrate."
  return
}

function Get-UniqueDestinationPath([string]$path) {
  if (-not (Test-Path $path)) {
    return $path
  }

  $directory = Split-Path -Parent $path
  $fileName = [IO.Path]::GetFileNameWithoutExtension($path)
  $extension = [IO.Path]::GetExtension($path)
  for ($index = 1; $index -lt 1000; $index++) {
    $candidate = Join-Path $directory "$fileName-$index$extension"
    if (-not (Test-Path $candidate)) {
      return $candidate
    }
  }

  throw "Could not find an unused destination for $path."
}

foreach ($file in $sourceFiles) {
  $captureDate = $file.LastWriteTime
  $dateFolder = Get-DeviceMatrixDateFolder $captureDate
  $deviceRoot = Join-Path (Join-Path $archiveRoot $dateFolder) $targetDevice
  $bucket = if ($file.Extension -match '^\.(png|jpe?g)$') { "images" } else { "logs" }
  $destinationDir = Join-Path $deviceRoot $bucket
  New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null

  $destinationPath = Get-UniqueDestinationPath (Join-Path $destinationDir $file.Name)
  Move-Item -LiteralPath $file.FullName -Destination $destinationPath
  Write-Host "Moved $($file.Name) -> $destinationPath"
}

Write-Host "Migration complete. Legacy root-level device matrix artifacts now live under $archiveRoot."
