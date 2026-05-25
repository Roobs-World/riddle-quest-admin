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
  [int]$Port = 8081,
  [string]$EmulatorHost = "10.0.2.2",
  [int]$WebSocketHoldSeconds = 10,
  [int]$AppScreenshotDelaySeconds = 20,
  [int]$ExpoLaunchTimeoutSeconds = 600,
  [int]$QASurfaceScreenshotDelaySeconds = 4,
  [string[]]$QASurfaceFilter = @(),
  [switch]$SkipMetroAssetProbe,
  [switch]$SkipQASurfaceScreenshots,
  [switch]$KeepPlayStoreEnabled,
  [switch]$ProbeOnly
)

$ErrorActionPreference = "Stop"

$QASurfaceIds = @()

$AndroidPackageName = "com.roobsworld.riddlequest"
$AndroidMainActivity = "$AndroidPackageName/.MainActivity"
$PlayStorePackageName = "com.android.vending"

$QASurfaceExpectedTexts = @{
  "page-app-loading" = @("Loading")
  "page-landing" = @("Play as Guest", "Made by Roobs World")
  "page-login" = @("Log in", "Log In", "Forgot password?")
  "page-sign-up" = @("Create your account", "Username", "Next")
  "page-forgot-password" = @("Reset Password")
  "page-new-password" = @("Set New Password", "Confirm")
  "page-riddle-loading" = @("Loading")
  "page-initialization-error" = @("Riddle database unavailable", "Retry")
  "page-game" = @("I grow in rows", "Hint", "SUBMIT", "Next")
  "modal-welcome" = @("Welcome to Riddle Quest!", "Solve engaging riddles")
  "modal-welcome-back" = @("Welcome back", "Tap to continue")
  "modal-instructions" = @("How to Play", "Got It!")
  "modal-info" = @("Debug Info", "OK")
  "modal-hint" = @("Use a Hint?", "SHOW HINT")
  "modal-skip" = @("Skip the level?", "SKIP LEVEL")
  "modal-victory" = @("NICE JOB!", "Next Level")
  "modal-loss" = @("So close!", "Watch Ad for 3 Extra Guesses", "Open Shop")
  "modal-coin-shop" = @("COIN SHOP", "Your balance", "PURCHASE")
  "modal-coin-purchase-fanfare" = @("Coins Added!", "Awesome")
  "modal-achievement-unlock-fanfare" = @("Achievement Unlocked!", "Nice")
  "modal-streak-increase-fanfare" = @("Streak Increased!", "Keep Going")
  "modal-level-up-fanfare" = @("Level Up!", "Awesome")
  "modal-settings" = @("Settings", "Sound", "Logout")
  "modal-full-profile-details" = @("PROFILE", "Daily puzzles completed")
  "modal-upgrade-account" = @("Upgrade your account", "Continue with Google", "Continue with Facebook")
  "modal-update-username" = @("Update Username", "Save")
  "modal-achievements" = @("Achievements")
  "modal-stats" = @("Statistics", "Games Played")
  "modal-leaderboard" = @("Leaderboard")
  "modal-credits" = @("Credits", "Close")
  "modal-about-legal" = @("About / Legal", "Privacy Policy")
  "modal-welcome-onboarding-progress" = @("Welcome to Riddle Quest!", "1/3")
  "modal-instructions-onboarding-progress" = @("How to Play", "3/3", "Got It!")
  "modal-info-onboarding-upgrade-action" = @("Guest Mode Notice", "Upgrade Account", "2/3", "OK")
  "modal-hint-insufficient-coins" = @("Use a Hint?", "You do not have enough coins for a hint.", "Buy coins")
  "modal-skip-insufficient-coins" = @("Skip the level?", "You do not have enough coins to skip a level.", "Buy coins")
  "modal-loss-no-continue-options" = @("So close!", "Out of attempts.", "Answer: HIDDEN", "Next Level")
  "modal-loss-coin-continue" = @("So close!", "3 Extra Guesses - 25 Coins", "Skip Puzzle")
  "modal-coin-shop-loading" = @("Loading shop...")
  "modal-coin-shop-error" = @("COIN SHOP", "Failed to load shop products")
  "modal-coin-shop-empty" = @("COIN SHOP", "No coin packs are available right now.", "PURCHASE")
  "modal-victory-sequence" = @("NICE JOB!", "Popup 1 of 4")
  "modal-achievement-unlock-fanfare-sequence" = @("Achievement Unlocked!", "Popup 1 of 4")
  "modal-streak-increase-fanfare-sequence" = @("Streak Increased!", "Popup 1 of 4")
  "modal-level-up-fanfare-sequence" = @("Level Up!", "Popup 1 of 4")
  "modal-settings-language-picker" = @("Language", "English", "Selected", "Close")
  "modal-upgrade-account-existing-account" = @("Account already exists", "Cancel", "Logout")
  "modal-delete-account-confirmation" = @("Delete Account", "Cancel")
  "modal-offline-blocking" = @("No Internet Connection", "Please reconnect")
  "popup-tooltip-submit-answer" = @("Submit your answer", "Got it")
  "popup-global-mute-overlay" = @("Mute sound")
}

function Fail($message) {
  throw "[android-emulator-run-matrix] $message"
}

function Get-QASurfaceIdsFromSource {
  $nodeCommand = Get-Command node -ErrorAction Stop
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $nodeCommand.Source "scripts/verify-android-matrix-coverage.js" "--ids" 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    Fail "Failed to read QA surface ids from src/qa/qaSurfaces.ts. node output: $($output -join "`n")"
  }

  try {
    return @($output | ConvertFrom-Json)
  } catch {
    Fail "Failed to parse QA surface ids emitted by scripts/verify-android-matrix-coverage.js. node output: $($output -join "`n")"
  }
}

function Assert-QASurfaceExpectedTextCoverage([string[]]$surfaceIds) {
  $missingExpectedText = @(
    $surfaceIds |
      Where-Object { -not $QASurfaceExpectedTexts.ContainsKey($_) }
  )
  if ($missingExpectedText.Count -gt 0) {
    Fail "Missing expected text checks for QA surface(s): $($missingExpectedText -join ', ')."
  }

  $unknownExpectedText = @(
    $QASurfaceExpectedTexts.Keys |
      Where-Object { $surfaceIds -notcontains $_ } |
      Sort-Object
  )
  if ($unknownExpectedText.Count -gt 0) {
    Fail "Expected text checks reference unknown QA surface(s): $($unknownExpectedText -join ', ')."
  }
}

function Initialize-QASurfaceInventory {
  $script:QASurfaceIds = @(Get-QASurfaceIdsFromSource)
  if ($script:QASurfaceIds.Count -eq 0) {
    Fail "QA surface inventory is empty."
  }

  Assert-QASurfaceExpectedTextCoverage $script:QASurfaceIds
  Write-Host "INFO: Android matrix screenshot inventory contains $($script:QASurfaceIds.Count) QA surfaces across $($AvdNames.Count) AVDs."
}

function Stop-ProcessTree($processId) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if (-not $process) {
    return
  }

  $allProcesses = Get-CimInstance Win32_Process
  $descendants = New-Object System.Collections.Generic.HashSet[int]
  $queue = New-Object System.Collections.Generic.Queue[int]
  [void]$queue.Enqueue([int]$processId)
  [void]$descendants.Add([int]$processId)

  while ($queue.Count -gt 0) {
    $parentId = $queue.Dequeue()
    $children = @($allProcesses | Where-Object { $_.ParentProcessId -eq $parentId })
    foreach ($child in $children) {
      if ($descendants.Add([int]$child.ProcessId)) {
        $queue.Enqueue([int]$child.ProcessId)
      }
    }
  }

  foreach ($id in @($descendants | Sort-Object -Descending)) {
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }
}

function Get-TextFileTail($path, $lineCount = 40) {
  if (-not (Test-Path $path)) {
    return ""
  }

  return ((Get-Content -Path $path -Tail $lineCount -ErrorAction SilentlyContinue) -join "`n")
}

function Resolve-PnpmCommand {
  $pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if (-not $pnpmCommand) {
    $pnpmCommand = Get-Command pnpm.exe -ErrorAction SilentlyContinue
  }
  if (-not $pnpmCommand) {
    $pnpmCommand = Get-Command pnpm -ErrorAction Stop
  }

  return $pnpmCommand.Source
}

function Restore-EnvVar($name, $value) {
  if ($null -eq $value) {
    Remove-Item "Env:\$name" -ErrorAction SilentlyContinue
  } else {
    Set-Item "Env:\$name" $value
  }
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

function Get-FirstEmulatorSerial($adb) {
  $devices = & $adb devices
  $line = $devices |
    Select-String -Pattern "^emulator-\d+\s+device" |
    Select-Object -First 1

  if (-not $line) {
    return $null
  }

  return ($line.Line -split "\s+")[0]
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
  $devices = & $adb devices
  $serials = @(
    $devices |
      Select-String -Pattern "^emulator-\d+\s+device" |
      ForEach-Object { ($_.Line -split "\s+")[0] }
  )

  foreach ($serial in $serials) {
    $runningAvdName = Get-EmulatorAvdName $adb $serial
    if ($runningAvdName -eq $avdName) {
      return $serial
    }
  }

  return $null
}

function Wait-ForFirstEmulatorSerial($adb, $timeoutSeconds = 60) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)

  do {
    $serial = Get-FirstEmulatorSerial $adb
    if ($serial) {
      return $serial
    }

    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  return $null
}

function Wait-ForEmulatorBoot($adb, $serial, $timeoutSeconds = 300) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)

  do {
    $bootCompleted = (& $adb -s $serial shell getprop sys.boot_completed 2>$null).Trim()
    if ($bootCompleted -eq "1") {
      return $true
    }

    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Invoke-AdbText($adb, [string[]]$arguments) {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $adb @arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return [pscustomobject]@{
    Text = ($output -join "`n")
    ExitCode = $exitCode
  }
}

function Wait-ForAdbDeviceOnline($adb, $serial, $timeoutSeconds = 30) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)

  do {
    $result = Invoke-AdbText $adb @("devices")
    $deviceLine = @(
      $result.Text -split "`n" |
        Where-Object { $_ -match "^$([regex]::Escape($serial))\s+device\b" }
    )

    if ($result.ExitCode -eq 0 -and $deviceLine.Count -gt 0) {
      return $true
    }

    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Test-AndroidPackageInstalled($adb, $serial, $packageName) {
  $result = Invoke-AdbText $adb @("-s", $serial, "shell", "pm", "path", $packageName)
  return $result.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($result.Text)
}

function Test-AndroidPackageDisabled($adb, $serial, $packageName) {
  $result = Invoke-AdbText $adb @("-s", $serial, "shell", "pm", "list", "packages", "-d")
  if ($result.ExitCode -ne 0) {
    Fail "Failed to list disabled Android packages on $serial. adb output: $($result.Text)"
  }

  return $result.Text -match "(?m)^package:$([regex]::Escape($packageName))$"
}

function Suspend-PlayStoreBackgroundUpdates($adb, $serial, $avdName) {
  if ($KeepPlayStoreEnabled) {
    Write-Host "INFO: Keeping Play Store enabled for $avdName because -KeepPlayStoreEnabled was passed."
    return [pscustomobject]@{
      PackageName = $PlayStorePackageName
      Installed = $false
      WasDisabled = $false
      Changed = $false
    }
  }

  if (-not (Test-AndroidPackageInstalled $adb $serial $PlayStorePackageName)) {
    Write-Host "INFO: Play Store is not installed on $avdName; no background update guard needed."
    return [pscustomobject]@{
      PackageName = $PlayStorePackageName
      Installed = $false
      WasDisabled = $false
      Changed = $false
    }
  }

  $wasDisabled = Test-AndroidPackageDisabled $adb $serial $PlayStorePackageName
  if ($wasDisabled) {
    Write-Host "INFO: Play Store was already disabled on $avdName; leaving it disabled during matrix run."
    return [pscustomobject]@{
      PackageName = $PlayStorePackageName
      Installed = $true
      WasDisabled = $true
      Changed = $false
    }
  }

  $disableResult = Invoke-AdbText $adb @("-s", $serial, "shell", "pm", "disable-user", "--user", "0", $PlayStorePackageName)
  if ($disableResult.ExitCode -ne 0) {
    Fail "Failed to disable Play Store on $avdName before matrix run. This guard prevents Play Store background Google Play Services updates from killing the app mid-test. adb output: $($disableResult.Text)"
  }

  Write-Host "INFO: Temporarily disabled Play Store on $avdName to prevent background Google Play Services package updates from terminating $AndroidPackageName during QA capture."
  return [pscustomobject]@{
    PackageName = $PlayStorePackageName
    Installed = $true
    WasDisabled = $false
    Changed = $true
  }
}

function Restore-PlayStoreBackgroundUpdates($adb, $serial, $state, $avdName) {
  if (-not $state -or -not $state.Installed -or -not $state.Changed) {
    return
  }

  $enableResult = Invoke-AdbText $adb @("-s", $serial, "shell", "pm", "enable", $state.PackageName)
  if ($enableResult.ExitCode -ne 0) {
    Write-Host "WARN: Failed to restore Play Store on $avdName after matrix run. adb output: $($enableResult.Text)"
    return
  }

  Write-Host "INFO: Restored Play Store on $avdName after matrix run."
}

function Stop-MatrixProcessIfRunning($process, $context) {
  if (-not $process) {
    return
  }

  $runningProcess = $null
  try {
    $runningProcess = Get-Process -Id $process.Id -ErrorAction Stop
  } catch {
    Write-Host "INFO: $context process $($process.Id) already exited before force-stop."
    return
  }

  try {
    Stop-Process -Id $runningProcess.Id -Force -ErrorAction Stop
  } catch {
    if (Get-Process -Id $runningProcess.Id -ErrorAction SilentlyContinue) {
      throw
    }

    Write-Host "INFO: $context process $($runningProcess.Id) exited during force-stop."
  }
}

function Start-MatrixAvd($adb, $emulator, $avdName, $timeoutSeconds = 300) {
  $runningSerial = Get-RunningSerialForAvd $adb $avdName
  if ($runningSerial) {
    if (-not (Wait-ForEmulatorBoot $adb $runningSerial $timeoutSeconds)) {
      Fail "$avdName is already running as $runningSerial but did not finish booting within ${timeoutSeconds}s."
    }

    Write-Host "Using already-running $avdName as $runningSerial."
    return [pscustomobject]@{
      Serial = $runningSerial
      Process = $null
      StartedByScript = $false
    }
  }

  $existingSerials = @(
    (& $adb devices) |
      Select-String -Pattern "^emulator-\d+\s+device" |
      ForEach-Object { ($_.Line -split "\s+")[0] }
  )

  Write-Host "Booting $avdName for Android matrix run..."
  $process = Start-Process `
    -FilePath $emulator `
    -ArgumentList @("-avd", $avdName, "-no-window", "-no-snapshot", "-no-snapshot-save", "-no-boot-anim", "-gpu", "swiftshader_indirect", "-no-audio") `
    -WindowStyle Hidden `
    -PassThru

  $serial = $null
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)

  do {
    Start-Sleep -Seconds 2
    $serial = Get-RunningSerialForAvd $adb $avdName
    if (-not $serial) {
      $currentSerials = @(
        (& $adb devices) |
          Select-String -Pattern "^emulator-\d+\s+device" |
          ForEach-Object { ($_.Line -split "\s+")[0] }
      )
      foreach ($candidateSerial in @($currentSerials | Where-Object { $_ -notin $existingSerials })) {
        $candidateAvdName = Get-EmulatorAvdName $adb $candidateSerial
        if ($candidateAvdName -eq $avdName) {
          $serial = $candidateSerial
          break
        }
      }
    }

    if ($serial -and (Wait-ForEmulatorBoot $adb $serial 5)) {
      return [pscustomobject]@{
        Serial = $serial
        Process = $process
        StartedByScript = $true
      }
    }
  } while ((Get-Date) -lt $deadline)

  if ($process -and -not $process.HasExited) {
    Stop-MatrixProcessIfRunning $process "$avdName boot-timeout emulator"
  }

  Fail "$avdName did not boot for Android matrix run within ${timeoutSeconds}s."
}

function Stop-MatrixAvd($adb, $target) {
  if (-not $target -or -not $target.StartedByScript) {
    return
  }

  if ($target.Serial) {
    & $adb -s $target.Serial emu kill | Out-Null
  }

  $process = $target.Process
  if ($process) {
    try {
      if (-not $process.HasExited -and -not $process.WaitForExit(45000)) {
        Stop-MatrixProcessIfRunning $process "$($target.Serial) emulator"
      }
    } catch {
      Stop-MatrixProcessIfRunning $process "$($target.Serial) emulator"
    }
  }
}

function Test-HostPortListening {
  @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).Count -gt 0
}

function Convert-ResponseContentToText($content) {
  if ($content -is [byte[]]) {
    return [Text.Encoding]::UTF8.GetString($content)
  }

  return [string]$content
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

function Assert-PngFile($path) {
  $pngHeader = [System.IO.File]::ReadAllBytes($path)[0..7]
  $expectedPngHeader = [byte[]](137, 80, 78, 71, 13, 10, 26, 10)
  for ($i = 0; $i -lt $expectedPngHeader.Length; $i++) {
    if ($pngHeader[$i] -ne $expectedPngHeader[$i]) {
      Fail "$path is not a valid PNG."
    }
  }
}

function Test-NormalizedPngFile($path) {
  try {
    if (-not (Test-Path $path)) {
      return [pscustomobject]@{ Ok = $false; Error = "$path was not created." }
    }

    $length = (Get-Item $path).Length
    if ($length -lt 8) {
      return [pscustomobject]@{ Ok = $false; Error = "$path is too small to be a PNG ($length bytes)." }
    }

    Normalize-PngFile $path
    Assert-PngFile $path
    return [pscustomobject]@{ Ok = $true; Error = "" }
  } catch {
    return [pscustomobject]@{ Ok = $false; Error = $_.Exception.Message }
  }
}

function Repair-AdbTransportForRetry($adb, $serial, $context) {
  Write-Host "WARN: Recovering ADB transport after $context screenshot capture problem."

  $startResult = Invoke-AdbText $adb @("start-server")
  if ($startResult.ExitCode -ne 0) {
    Write-Host "WARN: adb start-server failed while recovering $context capture: $($startResult.Text)"
  }

  if (-not (Wait-ForAdbDeviceOnline $adb $serial 30)) {
    Write-Host "WARN: $serial did not report as an online ADB device within 30s while recovering $context capture."
  }

  Start-Sleep -Seconds 2
}

function Capture-AndroidScreenshot($adb, $serial, $path, $context, $requiredForegroundPackage = $null, [int]$maxAttempts = 3) {
  $lastError = ""

  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    Remove-Item $path -Force -ErrorAction SilentlyContinue

    if ($requiredForegroundPackage) {
      if (-not (Wait-ForAndroidPackageInForeground $adb $serial $requiredForegroundPackage 15)) {
        $lastError = "$requiredForegroundPackage was not foreground before screenshot attempt $attempt."
        Write-Host "WARN: $lastError"
        if ($attempt -lt $maxAttempts) {
          Repair-AdbTransportForRetry $adb $serial $context
        }
        continue
      }
    }

    try {
      Invoke-AdbBinaryToFile $adb @("-s", $serial, "exec-out", "screencap", "-p") $path
      $pngResult = Test-NormalizedPngFile $path
      if ($pngResult.Ok) {
        if ($attempt -gt 1) {
          Write-Host "INFO: Screenshot capture recovered for $context on attempt $attempt."
        }
        return
      }

      $lastError = $pngResult.Error
    } catch {
      $lastError = $_.Exception.Message
    }

    Write-Host "WARN: Screenshot capture attempt $attempt/$maxAttempts failed for ${context}: $lastError"
    if ($attempt -lt $maxAttempts) {
      Repair-AdbTransportForRetry $adb $serial $context
    }
  }

  Fail "Could not capture a valid PNG for $context at $path after $maxAttempts attempt(s). Last error: $lastError"
}

function Get-UiTreeDump($adb, $serial) {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $adb -s $serial exec-out uiautomator dump /dev/tty 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return [pscustomobject]@{
    Text = ($output -join "`n")
    ExitCode = $exitCode
  }
}

function Test-AndroidPackageInForeground($adb, $serial, $packageName, [bool]$UseUiTreeFallback = $true) {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $windowDump = & $adb -s $serial shell dumpsys window 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -eq 0) {
    $foregroundLines = @(
      $windowDump |
        Where-Object { $_ -match "mCurrentFocus|mFocusedApp|mFocusedWindow|topResumedActivity|mTopResumedActivity" }
    )

    if (($foregroundLines -join "`n") -match [regex]::Escape($packageName)) {
      return $true
    }
  }

  $taskResult = Invoke-AdbText $adb @("-s", $serial, "shell", "am", "stack", "list")
  if (
    $taskResult.ExitCode -eq 0 -and
    $taskResult.Text -match [regex]::Escape($packageName) -and
    $taskResult.Text -match "visible=true"
  ) {
    return $true
  }

  if (-not $UseUiTreeFallback) {
    return $false
  }

  $uiDump = Get-UiTreeDump $adb $serial
  if ($uiDump.ExitCode -ne 0) {
    return $false
  }

  return $uiDump.Text -match [regex]::Escape("package=`"$packageName`"")
}

function Wait-ForAndroidPackageInForeground($adb, $serial, $packageName, $timeoutSeconds = 8) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)

  do {
    if (Test-AndroidPackageInForeground $adb $serial $packageName $false) {
      return $true
    }

    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Get-DevClientLaunchUri {
  return "exp+riddle-quest://expo-development-client/?url=http%3A%2F%2F${EmulatorHost}%3A$Port"
}

function Get-AndroidForegroundDiagnostics($adb, $serial) {
  $windowResult = Invoke-AdbText $adb @("-s", $serial, "shell", "dumpsys", "window")
  $taskResult = Invoke-AdbText $adb @("-s", $serial, "shell", "am", "stack", "list")
  $pidResult = Invoke-AdbText $adb @("-s", $serial, "shell", "pidof", "-s", $AndroidPackageName)

  $windowFocus = @(
    $windowResult.Text -split "`n" |
      Where-Object { $_ -match "mCurrentFocus|mFocusedApp|mFocusedWindow|topResumedActivity|mTopResumedActivity" }
  ) -join "`n"

  $taskLines = @(
    $taskResult.Text -split "`n" |
      Where-Object { $_ -match [regex]::Escape($AndroidPackageName) -or $_ -match "launcher|Task" }
  ) -join "`n"

  return @"
pidof ${AndroidPackageName}: $($pidResult.Text.Trim())

window focus:
$windowFocus

activity stacks:
$taskLines
"@
}

function Save-AppLaunchFailureEvidence($adb, $serial, $avdName, $context) {
  $root = (Resolve-Path ".").Path
  $imageDir = Join-Path $root "emulator-tests\images\$avdName"
  $logDir = Join-Path $root "emulator-tests\logs\$avdName"
  New-Item -ItemType Directory -Path $imageDir, $logDir -Force | Out-Null

  $safeContext = $context -replace "[^A-Za-z0-9_-]", "-"
  $screenshot = Join-Path $imageDir "launch-failure-$safeContext.png"
  $uiTree = Join-Path $logDir "launch-failure-$safeContext.xml"
  $logcat = Join-Path $logDir "launch-failure-$safeContext-logcat.txt"
  $diagnostics = Join-Path $logDir "launch-failure-$safeContext-diagnostics.txt"

  Get-AndroidForegroundDiagnostics $adb $serial | Out-File -FilePath $diagnostics -Encoding utf8

  $uiDump = Get-UiTreeDump $adb $serial
  $uiDump.Text | Out-File -FilePath $uiTree -Encoding utf8

  try {
    Capture-AndroidScreenshot $adb $serial $screenshot "launch failure $context" $null 2
  } catch {
    Write-Host "WARN: Failed to capture launch failure screenshot for $avdName ($context): $($_.Exception.Message)"
  }

  & $adb -s $serial logcat -d | Out-File -FilePath $logcat -Encoding utf8
  Write-Host "FAIL-EVIDENCE: Saved app launch failure evidence for ${avdName}: screenshot=$screenshot; ui=$uiTree; diagnostics=$diagnostics; logcat=$logcat"
}

function Invoke-DevClientLaunch($adb, $serial, $avdName, [int]$Attempt) {
  $devClientUri = Get-DevClientLaunchUri
  Write-Host "INFO: Explicit dev-client launch attempt $Attempt for ${avdName}: $devClientUri"

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $adb -s $serial shell am start -S -W -n $AndroidMainActivity -a android.intent.action.VIEW -d $devClientUri 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    Fail "Explicit dev-client launch attempt $Attempt failed for $avdName ($serial). adb output: $($output -join "`n")"
  }

  Write-Host "INFO: Explicit dev-client launch attempt $Attempt returned for ${avdName}. adb output: $($output -join "`n")"
}

function Ensure-DevClientForeground($adb, $serial, $avdName) {
  if (Wait-ForAndroidPackageInForeground $adb $serial $AndroidPackageName 30) {
    return
  }

  Write-Host "WARN: $AndroidPackageName was not foreground after Expo's launch marker for $avdName. Retrying with an explicit adb dev-client deep link after package replacement settles."
  for ($attempt = 1; $attempt -le 2; $attempt++) {
    Invoke-DevClientLaunch $adb $serial $avdName $attempt
    if (Wait-ForAndroidPackageInForeground $adb $serial $AndroidPackageName 90) {
      return
    }
  }

  Save-AppLaunchFailureEvidence $adb $serial $avdName "dev-client-foreground"
  $diagnostics = Get-AndroidForegroundDiagnostics $adb $serial
  Fail "$avdName did not bring $AndroidPackageName to the foreground after Expo launch plus explicit dev-client relaunch attempts.`n$diagnostics"
}

function Get-FirstNodeCenterByText($uiText, $text) {
  $escapedText = [regex]::Escape($text)
  $match = [regex]::Match($uiText, "text=""$escapedText"".{0,800}?bounds=""\[(\d+),(\d+)\]\[(\d+),(\d+)\]""", [Text.RegularExpressions.RegexOptions]::Singleline)
  if (-not $match.Success) {
    return $null
  }

  $left = [int]$match.Groups[1].Value
  $top = [int]$match.Groups[2].Value
  $right = [int]$match.Groups[3].Value
  $bottom = [int]$match.Groups[4].Value

  return [pscustomobject]@{
    X = [int](($left + $right) / 2)
    Y = [int](($top + $bottom) / 2)
  }
}

function Dismiss-ExpoDeveloperMenuIfPresent($adb, $serial, $avdName) {
  for ($attempt = 1; $attempt -le 2; $attempt++) {
    $uiDump = Get-UiTreeDump $adb $serial
    if ($uiDump.ExitCode -ne 0) {
      Write-Host "WARN: pre-screenshot UI tree capture failed for $avdName; cannot check Expo developer menu on attempt $attempt."
      return
    }

    if ($uiDump.Text -notmatch "developer menu") {
      return
    }

    $continueCenter = Get-FirstNodeCenterByText $uiDump.Text "Continue"
    if (-not $continueCenter) {
      Fail "$avdName is showing the Expo developer menu, but the Continue control was not found in the UI tree."
    }

    Write-Host "INFO: Dismissing Expo developer menu for $avdName at $($continueCenter.X),$($continueCenter.Y) before screenshot capture."
    & $adb -s $serial shell input tap $continueCenter.X $continueCenter.Y | Out-Null
    Start-Sleep -Seconds 10
  }

  $finalUiDump = Get-UiTreeDump $adb $serial
  if ($finalUiDump.Text -match "developer menu") {
    Fail "$avdName still shows the Expo developer menu after dismiss attempts; refusing to capture this as app evidence."
  }
}

function Capture-AppEvidence($adb, $serial, $avdName) {
  $root = (Resolve-Path ".").Path
  $imageDir = Join-Path $root "emulator-tests\images\$avdName"
  $logDir = Join-Path $root "emulator-tests\logs\$avdName"
  New-Item -ItemType Directory -Path $imageDir, $logDir -Force | Out-Null

  $screenshot = Join-Path $imageDir "05-matrix-app-post-launch.png"
  $uiTree = Join-Path $logDir "05-matrix-app-post-launch.xml"
  $logcat = Join-Path $logDir "05-matrix-app-post-launch-logcat.txt"

  Remove-Item $screenshot, $uiTree, $logcat -Force -ErrorAction SilentlyContinue

  if ($AppScreenshotDelaySeconds -gt 0) {
    Start-Sleep -Seconds $AppScreenshotDelaySeconds
  }

  Ensure-DevClientForeground $adb $serial $avdName

  Dismiss-ExpoDeveloperMenuIfPresent $adb $serial $avdName

  try {
    Capture-AndroidScreenshot $adb $serial $screenshot "post-launch app evidence for $avdName" $AndroidPackageName 3
  } catch {
    Save-AppLaunchFailureEvidence $adb $serial $avdName "app-screenshot"
    throw
  }

  $uiDump = Get-UiTreeDump $adb $serial
  $uiDump.Text | Out-File -FilePath $uiTree -Encoding utf8
  if ($uiDump.ExitCode -ne 0) {
    Write-Host "WARN: UI tree capture failed for $avdName ($serial); screenshot and logcat were still captured."
  } elseif ($uiDump.Text -match "developer menu") {
    Fail "$avdName final UI tree still shows the Expo developer menu; screenshot is not valid app evidence."
  }

  & $adb -s $serial logcat -d | Out-File -FilePath $logcat -Encoding utf8

  Write-Host "PASS: Captured app evidence for ${avdName}: screenshot=$screenshot; ui=$uiTree; logcat=$logcat"
}

function Open-QASurface($adb, $serial, $surfaceId) {
  $encodedSurfaceId = [Uri]::EscapeDataString($surfaceId)
  $uri = "exp+riddle-quest://qa?surface=$encodedSurfaceId"
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $adb -s $serial shell am start -W -n $AndroidMainActivity -a android.intent.action.VIEW -d $uri 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    Fail "Failed to open QA surface $surfaceId on $serial. adb output: $($output -join "`n")"
  }

  if (Wait-ForAndroidPackageInForeground $adb $serial $AndroidPackageName) {
    return
  }

  Write-Host "WARN: QA surface $surfaceId start returned successfully on $serial, but $AndroidPackageName was not foreground. Retrying launch with a cold launcher handoff. adb output: $($output -join "`n")"
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $monkeyOutput = & $adb -s $serial shell monkey -p $AndroidPackageName -c android.intent.category.LAUNCHER 1 2>&1
    $monkeyExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($monkeyExitCode -ne 0) {
    Fail "Cold launcher handoff failed for QA surface $surfaceId on $serial. adb output: $($monkeyOutput -join "`n")"
  }

  Start-Sleep -Seconds 2

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $retryOutput = & $adb -s $serial shell am start -W -n $AndroidMainActivity -a android.intent.action.VIEW -d $uri 2>&1
    $retryExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($retryExitCode -ne 0) {
    Fail "Failed to retry QA surface $surfaceId on $serial after foreground verification failed. adb output: $($retryOutput -join "`n")"
  }

  if (-not (Wait-ForAndroidPackageInForeground $adb $serial $AndroidPackageName)) {
    Fail "QA surface $surfaceId start command succeeded on $serial, but $AndroidPackageName never reached the foreground. Initial adb output: $($output -join "`n") Retry adb output: $($retryOutput -join "`n")"
  }
}

function Test-QASurfaceFunctionalText($surfaceId, $uiText) {
  if (-not $QASurfaceExpectedTexts.ContainsKey($surfaceId)) {
    return $true
  }

  foreach ($expectedText in $QASurfaceExpectedTexts[$surfaceId]) {
    if ($uiText -notmatch [regex]::Escape($expectedText)) {
      return $false
    }
  }

  return $true
}

function Wait-ForQASurfaceReady($adb, $serial, $surfaceId, $timeoutSeconds = 25) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  $expectedMarker = [regex]::Escape("qa-surface:$surfaceId")
  $hasExpectedFunctionalText = $QASurfaceExpectedTexts.ContainsKey($surfaceId)
  $lastDump = $null

  do {
    $dump = Get-UiTreeDump $adb $serial
    $lastDump = $dump
    if ($dump.ExitCode -eq 0 -and $dump.Text -match $expectedMarker) {
      return $dump
    }

    if ($hasExpectedFunctionalText -and $dump.ExitCode -eq 0 -and (Test-QASurfaceFunctionalText $surfaceId $dump.Text)) {
      return $dump
    }

    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)

  if ($lastDump -and $lastDump.Text -match "developer menu") {
    Fail "$serial is showing the Expo developer menu while waiting for QA surface $surfaceId."
  }

  $snippet = if ($lastDump) { $lastDump.Text.Substring(0, [Math]::Min(1000, $lastDump.Text.Length)) } else { "" }
  Fail "QA surface $surfaceId did not render its marker or required functional text within ${timeoutSeconds}s on $serial. UI snippet: $snippet"
}

function Assert-QASurfaceFunctionalText($surfaceId, $uiText, $serial) {
  if (-not $QASurfaceExpectedTexts.ContainsKey($surfaceId)) {
    return
  }

  foreach ($expectedText in $QASurfaceExpectedTexts[$surfaceId]) {
    if ($uiText -notmatch [regex]::Escape($expectedText)) {
      Fail "QA surface $surfaceId rendered on $serial, but expected functional text/control '$expectedText' was not present in the UI tree."
    }
  }
}

function Get-QASurfacesToCapture {
  $normalizedFilter = @(
    $QASurfaceFilter |
      ForEach-Object { $_ -split "," } |
      ForEach-Object { $_.Trim() } |
      Where-Object { $_ }
  )

  if (-not $normalizedFilter -or $normalizedFilter.Count -eq 0) {
    return @($QASurfaceIds)
  }

  $unknownSurfaces = @(
    $normalizedFilter |
      Where-Object { $QASurfaceIds -notcontains $_ }
  )

  if ($unknownSurfaces.Count -gt 0) {
    Fail "Unknown QA surface filter value(s): $($unknownSurfaces -join ', ')."
  }

  return @(
    $QASurfaceIds |
      Where-Object { $normalizedFilter -contains $_ }
  )
}

function Save-QASurfaceFailureEvidence($adb, $serial, $avdName, $surfaceId, $fileStem) {
  $root = (Resolve-Path ".").Path
  $imageDir = Join-Path $root "emulator-tests\images\$avdName\surfaces"
  $logDir = Join-Path $root "emulator-tests\logs\$avdName\surfaces"
  New-Item -ItemType Directory -Path $imageDir, $logDir -Force | Out-Null

  $failureScreenshot = Join-Path $imageDir "$fileStem-failure.png"
  $failureUiTree = Join-Path $logDir "$fileStem-failure.xml"
  $failureLogcat = Join-Path $logDir "$fileStem-failure-logcat.txt"

  $failureDump = Get-UiTreeDump $adb $serial
  $failureDump.Text | Out-File -FilePath $failureUiTree -Encoding utf8

  Capture-AndroidScreenshot $adb $serial $failureScreenshot "QA surface failure $surfaceId" $null 2
  & $adb -s $serial logcat -d | Out-File -FilePath $failureLogcat -Encoding utf8

  Write-Host "FAIL-EVIDENCE: Saved QA surface failure evidence for ${surfaceId}: screenshot=$failureScreenshot; ui=$failureUiTree; logcat=$failureLogcat"
}

function Capture-QASurfaceEvidence($adb, $serial, $avdName, $surfaceId, $index) {
  $root = (Resolve-Path ".").Path
  $imageDir = Join-Path $root "emulator-tests\images\$avdName\surfaces"
  $logDir = Join-Path $root "emulator-tests\logs\$avdName\surfaces"
  New-Item -ItemType Directory -Path $imageDir, $logDir -Force | Out-Null

  $ordinal = "{0:D2}" -f $index
  $fileStem = "06-$ordinal-$surfaceId"
  $screenshot = Join-Path $imageDir "$fileStem.png"
  $uiTree = Join-Path $logDir "$fileStem.xml"
  $logcat = Join-Path $logDir "$fileStem-logcat.txt"

  Remove-Item $screenshot, $uiTree, $logcat -Force -ErrorAction SilentlyContinue

  try {
    Open-QASurface $adb $serial $surfaceId
    if ($QASurfaceScreenshotDelaySeconds -gt 0) {
      Start-Sleep -Seconds $QASurfaceScreenshotDelaySeconds
    }
    Dismiss-ExpoDeveloperMenuIfPresent $adb $serial $avdName
    $uiDump = Wait-ForQASurfaceReady $adb $serial $surfaceId
    Assert-QASurfaceFunctionalText $surfaceId $uiDump.Text $serial
  } catch {
    Save-QASurfaceFailureEvidence $adb $serial $avdName $surfaceId $fileStem
    throw
  }
  $uiDump.Text | Out-File -FilePath $uiTree -Encoding utf8

  Capture-AndroidScreenshot $adb $serial $screenshot "QA surface $surfaceId for $avdName" $AndroidPackageName 3
  & $adb -s $serial logcat -d | Out-File -FilePath $logcat -Encoding utf8

  Write-Host "PASS: Captured QA surface $surfaceId for ${avdName}: screenshot=$screenshot; ui=$uiTree; logcat=$logcat"
}

function Capture-QASurfaceMatrixEvidence($adb, $serial, $avdName) {
  $surfacesToCapture = @(Get-QASurfacesToCapture)
  for ($i = 0; $i -lt $surfacesToCapture.Count; $i++) {
    Capture-QASurfaceEvidence $adb $serial $avdName $surfacesToCapture[$i] ($i + 1)
  }

  Write-Host "PASS: Captured $($surfacesToCapture.Count) QA screen/modal/popup surfaces for $avdName."
}

function Invoke-ExpoRunAndroid($adb, $serial, $avdName, [string[]]$expoArgs, [int]$Attempt = 1) {
  $pnpm = Resolve-PnpmCommand
  $logDir = Join-Path "emulator-tests\logs" $avdName
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  $logStem = if ($Attempt -eq 1) { "04-expo-run-android" } else { "04-expo-run-android-attempt$Attempt" }
  $stdoutFile = Join-Path $logDir "$logStem.stdout.txt"
  $stderrFile = Join-Path $logDir "$logStem.stderr.txt"
  $gradleStopFile = Join-Path $logDir "$logStem-gradle-stop.txt"
  Remove-Item -LiteralPath $stdoutFile, $stderrFile, $gradleStopFile -ErrorAction SilentlyContinue

  $process = Start-Process `
    -FilePath $pnpm `
    -ArgumentList $expoArgs `
    -WorkingDirectory (Resolve-Path ".").Path `
    -RedirectStandardOutput $stdoutFile `
    -RedirectStandardError $stderrFile `
    -WindowStyle Hidden `
    -PassThru
  $deadline = (Get-Date).AddSeconds($ExpoLaunchTimeoutSeconds)
  $nextDeveloperMenuCheck = (Get-Date).AddSeconds(8)

  while (-not $process.HasExited) {
    Start-Sleep -Seconds 2

    if ((Get-Date) -gt $deadline) {
      Stop-ProcessTree $process.Id
      try {
        & .\android\gradlew.bat --stop *>&1 | Out-File -FilePath $gradleStopFile -Encoding utf8
      } catch {
        $_ | Out-File -FilePath $gradleStopFile -Encoding utf8
      }

      $stdoutTail = Get-TextFileTail $stdoutFile
      $stderrTail = Get-TextFileTail $stderrFile
      Fail "expo run:android timed out after $ExpoLaunchTimeoutSeconds seconds for $avdName ($serial). stdout=$stdoutFile stderr=$stderrFile gradleStop=$gradleStopFile`nstdout tail:`n$stdoutTail`nstderr tail:`n$stderrTail"
    }

    if ((Get-Date) -lt $nextDeveloperMenuCheck) {
      continue
    }

    $nextDeveloperMenuCheck = (Get-Date).AddSeconds(5)
    $uiDump = Get-UiTreeDump $adb $serial
    if ($uiDump.ExitCode -eq 0 -and $uiDump.Text -match "developer menu") {
      Write-Host "INFO: Expo developer menu appeared before expo run:android returned for $avdName; dismissing it so launch can complete."
      Dismiss-ExpoDeveloperMenuIfPresent $adb $serial $avdName
    }
  }

  $process.WaitForExit()
  $process.Refresh()
  $exitCode = $process.ExitCode
  $process.Dispose()

  if ($null -eq $exitCode) {
    $stdoutTail = Get-TextFileTail $stdoutFile 80
    $stderrTail = Get-TextFileTail $stderrFile 80
    if ($stdoutTail -match "Opening exp\+.*expo-development-client") {
      Write-Host "INFO: expo run:android returned without a numeric exit code after opening the dev client for $avdName; treating the explicit launch marker as success. stdout=$stdoutFile stderr=$stderrFile"
      return
    }

    Fail "expo run:android exited without a numeric exit code for $avdName ($serial), and no dev-client launch marker was found. stdout=$stdoutFile stderr=$stderrFile`nstdout tail:`n$stdoutTail`nstderr tail:`n$stderrTail"
  }

  if ($exitCode -ne 0) {
    $stdoutTail = Get-TextFileTail $stdoutFile
    $stderrTail = Get-TextFileTail $stderrFile
    $combinedTail = "$stdoutTail`n$stderrTail"
    if ($Attempt -eq 1 -and $combinedTail -match "INSTALL_FAILED_INSUFFICIENT_STORAGE") {
      Write-Host "WARN: expo run:android hit INSTALL_FAILED_INSUFFICIENT_STORAGE for $avdName. Trimming caches, uninstalling the previous app package, and retrying once."
      & $adb -s $serial shell pm trim-caches 4096M | Out-Null
      & $adb -s $serial uninstall $AndroidPackageName | Out-Null
      Invoke-ExpoRunAndroid $adb $serial $avdName $expoArgs 2
      return
    }

    Fail "expo run:android failed for $avdName ($serial) with exit code $exitCode. stdout=$stdoutFile stderr=$stderrFile`nstdout tail:`n$stdoutTail`nstderr tail:`n$stderrTail"
  }
}

function Test-MetroPackagerRunning {
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:$Port/status" -UseBasicParsing -TimeoutSec 5
    $statusText = Convert-ResponseContentToText $response.Content
    return $statusText -match "packager-status:running"
  } catch {
    return $false
  }
}

function Assert-PortAvailableOrMetro {
  if (Test-MetroPackagerRunning) {
    return $true
  }

  if (Test-HostPortListening) {
    Fail "Port $Port is already in use, but http://localhost:$Port/status is not a running Metro packager. Stop that process or pass an unused -Port."
  }

  return $false
}

function Start-MetroServer {
  $pnpm = Resolve-PnpmCommand
  $logDir = "emulator-tests\logs"
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  $stdoutFile = Join-Path $logDir "00-metro.stdout.txt"
  $stderrFile = Join-Path $logDir "00-metro.stderr.txt"
  Remove-Item -LiteralPath $stdoutFile, $stderrFile -ErrorAction SilentlyContinue

  Write-Host "Starting Metro server on localhost:$Port for Android matrix run."
  $process = Start-Process `
    -FilePath $pnpm `
    -ArgumentList @("exec", "expo", "start", "--dev-client", "--host", "lan", "--port", "$Port") `
    -WorkingDirectory (Resolve-Path ".").Path `
    -RedirectStandardOutput $stdoutFile `
    -RedirectStandardError $stderrFile `
    -WindowStyle Hidden `
    -PassThru

  $deadline = (Get-Date).AddSeconds(120)
  while ((Get-Date) -lt $deadline) {
    if ($process.HasExited) {
      $process.Refresh()
      $exitCode = $process.ExitCode
      $process.Dispose()
      $stdoutTail = Get-TextFileTail $stdoutFile
      $stderrTail = Get-TextFileTail $stderrFile
      Fail "Metro exited before becoming ready with exit code $exitCode. stdout=$stdoutFile stderr=$stderrFile`nstdout tail:`n$stdoutTail`nstderr tail:`n$stderrTail"
    }

    if (Test-MetroPackagerRunning) {
      Write-Host "Metro server is running on localhost:$Port. stdout=$stdoutFile stderr=$stderrFile"
      return $process
    }

    Start-Sleep -Seconds 2
  }

  Stop-ProcessTree $process.Id
  $stdoutTail = Get-TextFileTail $stdoutFile
  $stderrTail = Get-TextFileTail $stderrFile
  Fail "Metro did not become ready within 120 seconds. stdout=$stdoutFile stderr=$stderrFile`nstdout tail:`n$stdoutTail`nstderr tail:`n$stderrTail"
}

function Ensure-MetroServer {
  if (Test-MetroPackagerRunning) {
    Write-Host "Reusing existing Metro server on localhost:$Port for Android matrix run."
    return $null
  }

  if (Test-HostPortListening) {
    Fail "Port $Port is already in use, but http://localhost:$Port/status is not a running Metro packager. Stop that process or pass an unused -Port."
  }

  return Start-MetroServer
}

function Get-AssetProbePath {
  $assetPath = "assets\fonts\Poppins-Bold.ttf"
  if (-not (Test-Path $assetPath)) {
    Fail "Metro asset probe file is missing: $assetPath"
  }

  $hash = (Get-FileHash -Algorithm MD5 $assetPath).Hash.ToLowerInvariant()
  return "/assets/?unstable_path=.%2Fassets/fonts/Poppins-Bold.ttf?platform=android&hash=$hash"
}

function Test-HostMetroAsset($assetProbePath) {
  $url = "http://localhost:$Port$assetProbePath"
  $tmp = Join-Path $env:TEMP ("qwordly-metro-host-probe-" + [IO.Path]::GetRandomFileName())

  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 -OutFile $tmp -PassThru
    $bytes = (Get-Item $tmp).Length

    if ($response.StatusCode -ne 200) {
      Fail "Metro host asset probe returned HTTP $($response.StatusCode) for $url"
    }

    if ($bytes -lt 100000) {
      Fail "Metro host asset probe returned only $bytes bytes for $url"
    }
  } finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
}

function Test-DeviceMetroAsset($adb, $serial, $assetProbePath) {
  $request = "GET $assetProbePath HTTP/1.1`r`nHost: ${EmulatorHost}:$Port`r`nConnection: close`r`n`r`n"
  $tmp = Join-Path $env:TEMP ("qwordly-metro-device-probe-" + [IO.Path]::GetRandomFileName())
  $remote = "/data/local/tmp/qwordly-metro-asset-probe-$([Guid]::NewGuid().ToString('N')).http"

  try {
    [IO.File]::WriteAllBytes($tmp, [Text.Encoding]::ASCII.GetBytes($request))
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      $pushOutput = & $adb -s $serial push $tmp $remote 2>&1
      $pushExitCode = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($pushExitCode -ne 0) {
      Fail "adb push failed for Metro asset probe: $($pushOutput -join "`n")"
    }
    $response = & $adb -s $serial shell "timeout 15 sh -c '(cat $remote; sleep 1) | nc -W 10 $EmulatorHost $Port | head -c 512'"

    if ($LASTEXITCODE -ne 0) {
      Fail "Emulator Metro asset probe command failed with exit code $LASTEXITCODE."
    }

    $responseText = ($response -join "`n")
    if ($responseText -notmatch "HTTP/1\.1 200 OK") {
      Fail "Emulator Metro asset probe did not receive HTTP 200 from ${EmulatorHost}:$Port. Response: $responseText"
    }

    if ($responseText -notmatch "Content-Length:\s*\d+") {
      Fail "Emulator Metro asset probe did not receive a complete asset response header. Response: $responseText"
    }
  } finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    & $adb -s $serial shell "rm -f $remote" | Out-Null
  }
}

function New-WebSocketProbeRequest($path, $hostHeader) {
  return "GET $path HTTP/1.1`r`nHost: $hostHeader`r`nUpgrade: websocket`r`nConnection: Upgrade`r`nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==`r`nSec-WebSocket-Version: 13`r`n`r`n"
}

function Assert-WebSocketUpgrade($responseText, $label) {
  if ($responseText -notmatch "HTTP/1\.1 101 Switching Protocols") {
    Fail "$label did not receive HTTP 101 Switching Protocols. Response: $responseText"
  }

  if ($responseText -notmatch "(?im)^Upgrade:\s*websocket\s*$") {
    Fail "$label did not receive a websocket Upgrade header. Response: $responseText"
  }
}

function Assert-TcpClientStillOpen($client, $label) {
  $socketClosed = $client.Client.Poll(0, [Net.Sockets.SelectMode]::SelectRead) -and $client.Available -eq 0
  if ($socketClosed) {
    Fail "$label closed before the $WebSocketHoldSeconds second websocket hold completed."
  }
}

function Test-HostMetroWebSocket($path) {
  $hostHeader = "localhost:$Port"
  $request = New-WebSocketProbeRequest $path $hostHeader
  $client = [Net.Sockets.TcpClient]::new()

  try {
    $connectTask = $client.ConnectAsync("localhost", $Port)
    if (-not $connectTask.Wait(5000)) {
      Fail "Host Metro websocket probe timed out connecting to $hostHeader$path."
    }

    $stream = $client.GetStream()
    $stream.ReadTimeout = 5000
    $requestBytes = [Text.Encoding]::ASCII.GetBytes($request)
    $stream.Write($requestBytes, 0, $requestBytes.Length)

    $buffer = New-Object byte[] 512
    $bytesRead = $stream.Read($buffer, 0, $buffer.Length)
    if ($bytesRead -le 0) {
      Fail "Host Metro websocket probe received no response from $hostHeader$path."
    }

    $responseText = [Text.Encoding]::ASCII.GetString($buffer, 0, $bytesRead)
    Assert-WebSocketUpgrade $responseText "Host Metro websocket probe for $path"
    Start-Sleep -Seconds $WebSocketHoldSeconds
    Assert-TcpClientStillOpen $client "Host Metro websocket probe for $path"
  } finally {
    $client.Close()
  }
}

function Test-DeviceMetroWebSocket($adb, $serial, $path) {
  $hostHeader = "${EmulatorHost}:$Port"
  $request = New-WebSocketProbeRequest $path $hostHeader
  $tmp = Join-Path $env:TEMP ("qwordly-metro-device-ws-probe-" + [IO.Path]::GetRandomFileName())
  $probeId = [Guid]::NewGuid().ToString('N')
  $remote = "/data/local/tmp/qwordly-metro-websocket-probe-$probeId.http"
  $remoteOut = "/data/local/tmp/qwordly-metro-websocket-probe-$probeId.out"
  $remotePid = "/data/local/tmp/qwordly-metro-websocket-probe-$probeId.pid"
  $inputHoldSeconds = $WebSocketHoldSeconds + 3

  try {
    [IO.File]::WriteAllBytes($tmp, [Text.Encoding]::ASCII.GetBytes($request))
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      $pushOutput = & $adb -s $serial push $tmp $remote 2>&1
      $pushExitCode = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($pushExitCode -ne 0) {
      Fail "adb push failed for Metro websocket probe: $($pushOutput -join "`n")"
    }

    $response = & $adb -s $serial shell "rm -f $remoteOut $remotePid; (sh -c 'cat $remote; sleep $inputHoldSeconds' | nc -W $($inputHoldSeconds + 5) $EmulatorHost $Port > $remoteOut 2>&1) & echo `$! > $remotePid; sleep 2; head -c 512 $remoteOut; echo; if ! kill -0 `$(cat $remotePid) 2>/dev/null; then echo __QWORDLY_WS_CLOSED_BEFORE_HOLD__; fi; sleep $WebSocketHoldSeconds; if ! kill -0 `$(cat $remotePid) 2>/dev/null; then echo __QWORDLY_WS_CLOSED_DURING_HOLD__; fi; kill `$(cat $remotePid) 2>/dev/null; wait `$(cat $remotePid) 2>/dev/null"
    if ($LASTEXITCODE -ne 0) {
      Fail "Emulator Metro websocket probe command failed with exit code $LASTEXITCODE."
    }

    $responseText = ($response -join "`n")
    Assert-WebSocketUpgrade $responseText "Emulator Metro websocket probe for $path"
    if ($responseText -match "__QWORDLY_WS_CLOSED_BEFORE_HOLD__|__QWORDLY_WS_CLOSED_DURING_HOLD__") {
      Fail "Emulator Metro websocket probe for $path closed before the $WebSocketHoldSeconds second hold completed. Response: $responseText"
    }
  } finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    & $adb -s $serial shell "rm -f $remote $remoteOut $remotePid" | Out-Null
  }
}

function Test-MetroAssetPath($adb, $serial = $null) {
  $assetProbePath = Get-AssetProbePath
  Test-HostMetroAsset $assetProbePath

  if (-not $serial) {
    $serial = Wait-ForFirstEmulatorSerial $adb 60
  }
  if (-not $serial) {
    Fail "No booted emulator is available for the Metro asset probe after waiting 60s."
  }

  Test-DeviceMetroAsset $adb $serial $assetProbePath

  $messagePath = "/message?device=matrix-probe&app=com.roobsworld.riddlequest&clientid=matrixProbe"
  $inspectorPath = "/inspector/network"
  Test-HostMetroWebSocket $messagePath
  Test-HostMetroWebSocket $inspectorPath
  Test-DeviceMetroWebSocket $adb $serial $messagePath
  Test-DeviceMetroWebSocket $adb $serial $inspectorPath

  Write-Host "PASS: Metro asset and websocket probes succeeded on host localhost:$Port and emulator ${EmulatorHost}:$Port, including $WebSocketHoldSeconds second websocket holds."
}

$previousReactNativePackagerHostname = $env:REACT_NATIVE_PACKAGER_HOSTNAME
$previousExpoPackagerProxyUrl = $env:EXPO_PACKAGER_PROXY_URL
$previousGradleUserHome = $env:GRADLE_USER_HOME
$metroProcess = $null

try {
  $sdkRoot = Resolve-AndroidSdk
  $adb = Join-Path $sdkRoot "platform-tools\adb.exe"
  if (-not (Test-Path $adb)) {
    Fail "SDK-local adb.exe not found at $adb."
  }
  $emulator = Join-Path $sdkRoot "emulator\emulator.exe"
  if (-not (Test-Path $emulator)) {
    Fail "emulator.exe not found at $emulator."
  }

  $localGradleHome = Join-Path (Resolve-Path ".").Path ".gradle-local"
  New-Item -ItemType Directory -Path $localGradleHome -Force | Out-Null

  $env:REACT_NATIVE_PACKAGER_HOSTNAME = $EmulatorHost
  $env:EXPO_PACKAGER_PROXY_URL = "http://${EmulatorHost}:$Port"
  $env:GRADLE_USER_HOME = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { $localGradleHome }

  Write-Host "Using Android emulator host-alias Expo dev-client URLs for emulator QA:"
  Write-Host "  REACT_NATIVE_PACKAGER_HOSTNAME=$env:REACT_NATIVE_PACKAGER_HOSTNAME"
  Write-Host "  EXPO_PACKAGER_PROXY_URL=$env:EXPO_PACKAGER_PROXY_URL"

  Initialize-QASurfaceInventory

  $metroProcess = Ensure-MetroServer

  if ($ProbeOnly) {
    Test-MetroAssetPath $adb
    return
  }

  foreach ($avd in $AvdNames) {
    Write-Host "Running Android matrix target $avd..."
    $target = Start-MatrixAvd $adb $emulator $avd
    $playStoreState = $null

    try {
      $playStoreState = Suspend-PlayStoreBackgroundUpdates $adb $target.Serial $avd

      Assert-PortAvailableOrMetro | Out-Null
      $expoArgs = @("exec", "expo", "run:android", "--device", $avd)
      $debugApk = Join-Path (Resolve-Path ".").Path "android\app\build\outputs\apk\debug\app-debug.apk"
      if (Test-Path $debugApk) {
        Write-Host "Using prebuilt debug APK for ${avd}: $debugApk"
        $expoArgs += @("--binary", $debugApk)
      }

      Write-Host "Using Metro server on localhost:$Port for $avd."
      $expoArgs += "--no-bundler"

      Invoke-ExpoRunAndroid $adb $target.Serial $avd $expoArgs

      if (-not $SkipMetroAssetProbe) {
        Test-MetroAssetPath $adb $target.Serial
      }

      Capture-AppEvidence $adb $target.Serial $avd
      if (-not $SkipQASurfaceScreenshots) {
        Capture-QASurfaceMatrixEvidence $adb $target.Serial $avd
      }
    } finally {
      Restore-PlayStoreBackgroundUpdates $adb $target.Serial $playStoreState $avd
      Stop-MatrixAvd $adb $target
    }
  }

  Write-Host "PASS: Android emulator run matrix completed."
} finally {
  if ($metroProcess) {
    Stop-ProcessTree $metroProcess.Id
  }
  Restore-EnvVar "REACT_NATIVE_PACKAGER_HOSTNAME" $previousReactNativePackagerHostname
  Restore-EnvVar "EXPO_PACKAGER_PROXY_URL" $previousExpoPackagerProxyUrl
  Restore-EnvVar "GRADLE_USER_HOME" $previousGradleUserHome
}
