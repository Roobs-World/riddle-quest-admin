param(
  [string[]]$AvdNames = @(
    "rq_pixel_4a_api_36_1",
    "rq_pixel_7_api_36_1",
    "rq_pixel_8_pro_api_36_1",
    "rq_pixel_fold_outer_api_36_1",
    "rq_pixel_fold_unfolded_api_36_1",
    "rq_small_tablet_api_36_1",
    "rq_large_tablet_api_36_1",
    "rq_low_density_tablet_api_36_1"
  ),
  [int]$TimeoutSeconds = 300,
  [int]$ShutdownGraceSeconds = 45,
  [string]$GpuMode = "swiftshader_indirect",
  [switch]$CleanLocks
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot\device-matrix-artifacts.ps1"

$script:MatrixCaptureDate = Get-Date
$script:MatrixWorkspaceRoot = (Resolve-Path ".").Path

function Fail($message) {
  throw "[android-emulator-health] $message"
}

function Get-MatrixArtifactDirs([string]$deviceName) {
  return New-DeviceMatrixArtifactDirs `
    -WorkspaceRoot $script:MatrixWorkspaceRoot `
    -CaptureDate $script:MatrixCaptureDate `
    -DeviceName $deviceName
}

function Get-EmulatorHostProcesses {
  Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -eq "emulator" -or $_.ProcessName -like "qemu-system*" }
}

function Get-EmulatorHostProcessesForAvd($avdName) {
  if (-not $avdName) {
    return @(Get-EmulatorHostProcesses)
  }

  $escapedAvdName = [regex]::Escape($avdName)
  $processIds = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      ($_.Name -eq "emulator.exe" -or $_.Name -like "qemu-system*.exe") -and
      ($_.CommandLine -match $escapedAvdName)
    } |
    ForEach-Object { $_.ProcessId }

  if (-not $processIds) {
    return @()
  }

  @($processIds | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
}

function Test-ProcessIsRunning($process) {
  if (-not $process) {
    return $false
  }

  try {
    $process.Refresh()
    return -not $process.HasExited
  } catch {
    return $false
  }
}

function Get-NewEmulatorHostProcesses($baselineProcessIds) {
  $baseline = @($baselineProcessIds)
  @(Get-EmulatorHostProcesses | Where-Object { $_.Id -notin $baseline })
}

function Wait-ForEmulatorHostProcessDrain($baselineProcessIds, $timeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)

  do {
    $remaining = @(Get-NewEmulatorHostProcesses $baselineProcessIds)
    if (-not $remaining) {
      return $true
    }

    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Get-AvdNameForLock($lockPath, $avdRoot) {
  $relativePath = $lockPath.Substring($avdRoot.Length).TrimStart([char[]]@('\', '/'))
  $pathParts = $relativePath -split '[\\/]'

  foreach ($part in $pathParts) {
    if ($part -match '^(?<name>.+)\.avd$') {
      return $matches.name
    }
  }

  if ($pathParts.Count -gt 0 -and $pathParts[0] -match '^(?<name>.+)\.ini\.lock$') {
    return $matches.name
  }

  return $null
}

function Resolve-AndroidSdk {
  if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
    return (Resolve-Path $env:ANDROID_HOME).Path
  }

  if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) {
    return (Resolve-Path $env:ANDROID_SDK_ROOT).Path
  }

  $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path $defaultSdk) {
    return (Resolve-Path $defaultSdk).Path
  }

  Fail "Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT."
}

function Remove-StaleAvdLocks($avdRoot) {
  $locks = @(Get-ChildItem -Path $avdRoot -Filter "*.lock" -Recurse -Force -ErrorAction SilentlyContinue)
  foreach ($lock in $locks) {
    if (-not $lock.FullName.StartsWith($avdRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      Fail "Refusing to remove lock outside AVD root: $($lock.FullName)"
    }

    $lockAvdName = Get-AvdNameForLock $lock.FullName $avdRoot
    $runningForLock = if ($lockAvdName) {
      @(Get-EmulatorHostProcessesForAvd $lockAvdName)
    } else {
      @(Get-EmulatorHostProcesses)
    }

    if ($runningForLock) {
      $lockLabel = if ($lockAvdName) { $lockAvdName } else { "unknown AVD" }
      Write-Host "Skipping active lock for $lockLabel because emulator/QEMU is running: $($lock.FullName)"
      continue
    }

    Remove-Item -LiteralPath $lock.FullName -Recurse -Force
    Write-Host "Removed stale lock: $($lock.FullName)"
  }
}

function Invoke-AdbQuiet($adb, [string[]]$arguments) {
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $adb
  $psi.Arguments = ($arguments | ForEach-Object {
    if ($_ -match '[\s"]') {
      '"' + ($_ -replace '"', '\"') + '"'
    } else {
      $_
    }
  }) -join " "
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false

  $process = [System.Diagnostics.Process]::Start($psi)
  try {
    $null = $process.StandardOutput.ReadToEnd()
    $null = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return $process.ExitCode
  } finally {
    $process.Dispose()
  }
}

function Get-EmulatorSerials($adb) {
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $adb
  $psi.Arguments = "devices"
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false

  $process = [System.Diagnostics.Process]::Start($psi)
  try {
    $output = $process.StandardOutput.ReadToEnd()
    $null = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
  } finally {
    $process.Dispose()
  }

  $output -split "`r?`n" |
    Select-String -Pattern "^emulator-\d+\s+device" |
    ForEach-Object { ($_.Line -split "\s+")[0] }
}

function Get-EmulatorAvdName($adb, $serial) {
  if (-not $serial) {
    return $null
  }

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $adb -s $serial emu avd name 2>$null
    if ($LASTEXITCODE -ne 0) {
      return $null
    }
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  $lines = @(
    $output |
      ForEach-Object { "$_".Trim() } |
      Where-Object { $_ -and $_ -ne "OK" }
  )

  if (-not $lines) {
    return $null
  }

  return $lines[0]
}

function Get-RunningSerialForAvd($adb, $avdName) {
  foreach ($serial in @(Get-EmulatorSerials $adb)) {
    $runningAvdName = Get-EmulatorAvdName $adb $serial
    if ($runningAvdName -eq $avdName) {
      return $serial
    }
  }

  return $null
}

function Invoke-AdbBinaryToFile($adb, [string[]]$arguments, $outputPath) {
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $adb
  $psi.Arguments = ($arguments | ForEach-Object {
    if ($_ -match '[\s"]') {
      '"' + ($_ -replace '"', '\"') + '"'
    } else {
      $_
    }
  }) -join " "
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false

  $process = [System.Diagnostics.Process]::Start($psi)
  $fileStream = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  try {
    $buffer = New-Object byte[] 81920
    while (($read = $process.StandardOutput.BaseStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
      $fileStream.Write($buffer, 0, $read)
    }
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) {
      $errorText = $process.StandardError.ReadToEnd()
      Fail "adb binary capture failed with exit code $($process.ExitCode): $errorText"
    }
  } finally {
    $fileStream.Dispose()
    $process.Dispose()
  }
}

function Normalize-PngFile($path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $pngHeader = [byte[]](137, 80, 78, 71, 13, 10, 26, 10)
  $pngOffset = -1

  for ($i = 0; $i -le $bytes.Length - $pngHeader.Length; $i++) {
    $matchesHeader = $true
    for ($j = 0; $j -lt $pngHeader.Length; $j++) {
      if ($bytes[$i + $j] -ne $pngHeader[$j]) {
        $matchesHeader = $false
        break
      }
    }

    if ($matchesHeader) {
      $pngOffset = $i
      break
    }
  }

  if ($pngOffset -lt 0) {
    Fail "$path does not contain a PNG header."
  }

  if ($pngOffset -gt 0) {
    $trimmed = New-Object byte[] ($bytes.Length - $pngOffset)
    [Array]::Copy($bytes, $pngOffset, $trimmed, 0, $trimmed.Length)
    [System.IO.File]::WriteAllBytes($path, $trimmed)
  }
}

function Format-ProcessList($processes) {
  @($processes | ForEach-Object { "$($_.ProcessName):$($_.Id)" }) -join ", "
}

function Wait-ForEmulatorShutdown($adb, $serial, $process, $avdName, $timeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)

  do {
    Start-Sleep -Seconds 1
    $processRunning = Test-ProcessIsRunning $process
    $avdProcesses = @(Get-EmulatorHostProcessesForAvd $avdName)
    $serialStillVisible = $false

    if ($serial) {
      $serialStillVisible = @(Get-EmulatorSerials $adb) -contains $serial
    }

    if (-not $processRunning -and -not $avdProcesses -and -not $serialStillVisible) {
      return $true
    }
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Stop-Emulator($adb, $serial, $process, $avdName, $shutdownGraceSeconds) {
  if ($serial) {
    $killExitCode = Invoke-AdbQuiet $adb @("-s", $serial, "emu", "kill")
    if ($killExitCode -ne 0) {
      Write-Host "WARN: adb emu kill returned exit code $killExitCode for $serial; continuing shutdown verification."
    }
  }

  if (Wait-ForEmulatorShutdown $adb $serial $process $avdName $shutdownGraceSeconds) {
    Invoke-AdbQuiet $adb @("kill-server") | Out-Null
    return
  }

  $targets = @()
  if (Test-ProcessIsRunning $process) {
    $targets += Get-Process -Id $process.Id -ErrorAction SilentlyContinue
  }
  $targets += Get-EmulatorHostProcessesForAvd $avdName
  $targets = @($targets | Where-Object { $_ } | Sort-Object Id -Unique)

  if ($targets) {
    Write-Host "WARN: $avdName did not exit within ${shutdownGraceSeconds}s after console kill; force-stopping: $(Format-ProcessList $targets)"
    foreach ($target in $targets) {
      try {
        Stop-Process -Id $target.Id -Force -ErrorAction Stop
      } catch {
        if (Get-Process -Id $target.Id -ErrorAction SilentlyContinue) {
          throw
        }
      }
    }
  }

  if (-not (Wait-ForEmulatorShutdown $adb $serial $process $avdName 15)) {
    $remaining = @(Get-EmulatorHostProcessesForAvd $avdName)
    Fail "Emulator $avdName did not shut down cleanly. Remaining host processes: $(Format-ProcessList $remaining)"
  }

  Invoke-AdbQuiet $adb @("kill-server") | Out-Null
}

$sdkRoot = Resolve-AndroidSdk
$adb = Join-Path $sdkRoot "platform-tools\adb.exe"
$emulator = Join-Path $sdkRoot "emulator\emulator.exe"
$avdRoot = Join-Path $env:USERPROFILE ".android\avd"

if (-not (Test-Path $adb)) {
  Fail "SDK-local adb.exe not found at $adb."
}
if (-not (Test-Path $emulator)) {
  Fail "emulator.exe not found at $emulator."
}
if (-not (Test-Path $avdRoot)) {
  Fail "AVD root not found at $avdRoot."
}

$resolvedAvdRoot = (Resolve-Path $avdRoot).Path

if ($CleanLocks) {
  Remove-StaleAvdLocks $resolvedAvdRoot
}

$baselineHostProcessIds = @(Get-EmulatorHostProcesses | ForEach-Object { $_.Id })

Invoke-AdbQuiet $adb @("kill-server") | Out-Null
Invoke-AdbQuiet $adb @("start-server") | Out-Null

$summary = @()

foreach ($avd in $AvdNames) {
  $artifactDirs = Get-MatrixArtifactDirs $avd
  $logDir = $artifactDirs.LogDir
  $imageDir = $artifactDirs.ImageDir

  $stdout = Join-Path $logDir "03-health-boot-stdout.txt"
  $stderr = Join-Path $logDir "03-health-boot-stderr.txt"
  $devicesLog = Join-Path $logDir "03-health-adb-devices.txt"
  $sizeLog = Join-Path $logDir "03-health-wm-size.txt"
  $densityLog = Join-Path $logDir "03-health-wm-density.txt"
  $logcatLog = Join-Path $logDir "03-health-logcat.txt"
  $screenshot = Join-Path $imageDir "03-health-boot-home.png"

  Remove-Item $stdout, $stderr, $devicesLog, $sizeLog, $densityLog, $logcatLog, $screenshot -Force -ErrorAction SilentlyContinue

  $existing = Get-EmulatorSerials $adb
  $serial = Get-RunningSerialForAvd $adb $avd
  $process = $null
  $startedByScript = $false
  $status = "FAIL"
  $details = ""

  if ($serial) {
    Write-Host "Using already-running $avd as $serial (timeout ${TimeoutSeconds}s)..."
  } else {
    Write-Host "Booting $avd with $GpuMode (timeout ${TimeoutSeconds}s)..."
    $process = Start-Process `
      -FilePath $emulator `
      -ArgumentList @("-avd", $avd, "-no-window", "-no-snapshot", "-no-snapshot-save", "-no-boot-anim", "-gpu", $GpuMode, "-no-audio", "-verbose") `
      -WindowStyle Hidden `
      -PassThru `
      -RedirectStandardOutput $stdout `
      -RedirectStandardError $stderr
    $startedByScript = $true
  }

  try {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
      Start-Sleep -Seconds 5
      & $adb devices -l | Out-File -FilePath $devicesLog -Encoding utf8
      if (-not $serial) {
        $serial = Get-RunningSerialForAvd $adb $avd
      }
      if (-not $serial) {
        $current = Get-EmulatorSerials $adb
        foreach ($candidateSerial in @($current | Where-Object { $_ -notin $existing })) {
          $candidateAvdName = Get-EmulatorAvdName $adb $candidateSerial
          if ($candidateAvdName -eq $avd) {
            $serial = $candidateSerial
            break
          }
        }
      }

      if ($serial) {
        $bootCompleted = (& $adb -s $serial shell getprop sys.boot_completed 2>$null).Trim()
        if ($bootCompleted -eq "1") {
          break
        }
      }
    }

    if (-not $serial) {
      Fail "$avd did not register with ADB within ${TimeoutSeconds}s."
    }

    $bootCompleted = (& $adb -s $serial shell getprop sys.boot_completed 2>$null).Trim()
    if ($bootCompleted -ne "1") {
      Fail "$avd registered as $serial but sys.boot_completed=$bootCompleted after ${TimeoutSeconds}s."
    }

    & $adb -s $serial shell wm size | Out-File -FilePath $sizeLog -Encoding utf8
    & $adb -s $serial shell wm density | Out-File -FilePath $densityLog -Encoding utf8
    Invoke-AdbBinaryToFile $adb @("-s", $serial, "exec-out", "screencap", "-p") $screenshot
    Normalize-PngFile $screenshot
    & $adb -s $serial logcat -d | Out-File -FilePath $logcatLog -Encoding utf8

    $pngHeader = [System.IO.File]::ReadAllBytes($screenshot)[0..7]
    $expectedPngHeader = [byte[]](137, 80, 78, 71, 13, 10, 26, 10)
    for ($i = 0; $i -lt $expectedPngHeader.Length; $i++) {
      if ($pngHeader[$i] -ne $expectedPngHeader[$i]) {
        Fail "$avd screenshot is not a valid PNG."
      }
    }

    $status = "PASS"
    $details = "$avd booted as $serial; screenshot=$screenshot; logs=$logDir"
    Write-Host "PASS: $details"
  } catch {
    $details = $_.Exception.Message
    Write-Host "FAIL: $details"
  } finally {
    if ($startedByScript) {
      Stop-Emulator $adb $serial $process $avd $ShutdownGraceSeconds
    } else {
      Write-Host "Leaving already-running $avd ($serial) open."
    }
  }

  $summary += [pscustomobject]@{
    AVD = $avd
    Status = $status
    Details = $details
  }
}

$summaryPath = Join-Path (Get-MatrixArtifactDirs "shared").LogDir "android-emulator-health-summary.txt"
$summary | Format-Table -AutoSize | Out-File -FilePath $summaryPath -Encoding utf8
$summary | Format-Table -AutoSize

if ($summary.Status -contains "FAIL") {
  Fail "One or more AVD health checks failed. See $summaryPath."
}

Start-Sleep -Seconds 3
Invoke-AdbQuiet $adb @("kill-server") | Out-Null

$remainingHostProcesses = @(Get-NewEmulatorHostProcesses $baselineHostProcessIds)
if ($remainingHostProcesses -and -not (Wait-ForEmulatorHostProcessDrain $baselineHostProcessIds $ShutdownGraceSeconds)) {
  $remainingHostProcesses = @(Get-NewEmulatorHostProcesses $baselineHostProcessIds)
  Fail "Emulator host processes are still running after health checks: $(Format-ProcessList $remainingHostProcesses)"
}

if ($CleanLocks) {
  Remove-StaleAvdLocks $resolvedAvdRoot
}

Write-Host "PASS: all requested AVD health checks completed."
