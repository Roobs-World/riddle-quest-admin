param(
  [int]$Port = 8081,
  [string]$EmulatorHost = "127.0.0.1",
  [string]$AndroidPackageName = "com.roobsworld.riddlequest"
)

$ErrorActionPreference = "Stop"

function Fail($message) {
  throw "[open-android-dev-client] $message"
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  Fail "adb is not on PATH."
}

Write-Host "Using adb reverse for localhost:$Port and opening the Expo dev-client URI for $AndroidPackageName."
& adb reverse tcp:$Port tcp:$Port | Out-Null
& adb shell am force-stop $AndroidPackageName | Out-Null

$uri = "exp+riddle-quest://expo-development-client/?url=http%3A%2F%2F${EmulatorHost}%3A$Port"
Write-Host "Opening: $uri"

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
  $output = & adb shell am start -W -a android.intent.action.VIEW -d $uri $AndroidPackageName 2>&1
  $exitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousErrorActionPreference
}

if ($exitCode -ne 0) {
  Fail "Failed to open the dev client. adb output:`n$($output -join "`n")"
}

Write-Host ($output -join "`n")
