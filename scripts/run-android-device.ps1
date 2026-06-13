param(
  [int]$Port = 8081,
  [string]$AndroidPackageName = "com.roobsworld.riddlequest",
  [switch]$DebugCli
)

$ErrorActionPreference = "Stop"

function Fail($message) {
  throw "[run-android-device] $message"
}

function Test-PortListening([int]$TestPort) {
  $matches = netstat -ano | Select-String -Pattern "LISTENING\s+\d+$TestPort"
  if ($matches) {
    return $true
  }

  $matches = netstat -ano | Select-String -Pattern ":$TestPort\s+.*LISTENING"
  return [bool]$matches
}

function Ensure-MetroServer([int]$MetroPort, [switch]$EnableDebugCli) {
  if (Test-PortListening $MetroPort) {
    Write-Host "Metro is already listening on port $MetroPort."
    return
  }

  $logFile = "metro-$MetroPort.log"
  $debugPrefix = ""
  if ($EnableDebugCli) {
    $debugPrefix = '$env:EXPO_DEBUG=''true''; '
  }

  $command =
    "Set-Location 'E:\qwordly'; " +
    '$env:CI=''1''; ' +
    $debugPrefix +
    "pnpm exec expo start --dev-client --host localhost --port $MetroPort --clear *>&1 | Tee-Object -FilePath '$logFile'"

  $process = Start-Process -FilePath powershell `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $command `
    -WindowStyle Hidden `
    -PassThru

  Write-Host "Started Metro in the background (PID $($process.Id)); waiting for port $MetroPort."

  $deadline = (Get-Date).AddMinutes(2)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortListening $MetroPort) {
      Write-Host "Metro is ready on port $MetroPort."
      return
    }

    Start-Sleep -Seconds 2
  }

  Fail "Metro did not start on port $MetroPort within 2 minutes. Check $logFile."
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  Fail "adb is not on PATH."
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Fail "pnpm is not on PATH."
}

$deviceLines = & adb devices 2>&1
if (-not ($deviceLines | Select-String -Pattern "device$")) {
  Fail "No Android device is connected and authorized. adb output:`n$($deviceLines -join "`n")"
}

Ensure-MetroServer -MetroPort $Port -EnableDebugCli:$DebugCli

$env:GRADLE_USER_HOME = ".gradle-local"
if ($DebugCli) {
  $env:EXPO_DEBUG = "true"
}

Write-Host "Building and installing the Android app without Expo's bundled dev-server handoff."
& pnpm exec expo run:android --no-bundler
if ($LASTEXITCODE -ne 0) {
  Fail "expo run:android --no-bundler failed with exit code $LASTEXITCODE."
}

Write-Host "Opening the installed dev client on the connected Android device."
& powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/open-android-dev-client.ps1" `
  -Port $Port `
  -EmulatorHost "127.0.0.1" `
  -AndroidPackageName $AndroidPackageName

if ($LASTEXITCODE -ne 0) {
  Fail "Failed to open the Android dev client."
}
