# collect-android-evidence.ps1
# Usage: .\collect-android-evidence.ps1 -Name "login-flow-1" [-DeviceId emulator-5554]
param(
    [string]$Name = "evidence",
    [string]$DeviceId = ""
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$base = "emulator-tests/logs/$timestamp-$Name"
if (-not (Test-Path $base)) { New-Item -ItemType Directory -Path $base -Force | Out-Null }

$adb = "adb"
if ($DeviceId -ne "") { $deviceArg = "-s $DeviceId" } else { $deviceArg = "" }

Write-Output "Capturing screenshot..."
& $adb $deviceArg shell screencap -p /sdcard/screen.png
& $adb $deviceArg pull /sdcard/screen.png "$base/screen.png"

Write-Output "Collecting logcat..."
& $adb $deviceArg logcat -d > "$base/logcat.txt"

Write-Output "Collecting dumpsys window windows (layout state)..."
& $adb $deviceArg shell dumpsys window windows > "$base/dumpsys-windows.txt"

Write-Output "Done. Artifacts in $base"

*** End of file