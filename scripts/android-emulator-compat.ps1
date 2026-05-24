param(
  [switch]$Build,
  [int]$TimeoutSeconds = 600,
  [string]$ApkPath = "android/app/build/outputs/apk/debug/app-debug.apk"
)

$ErrorActionPreference = "Stop"

$expectedAvds = @(
  "rq_pixel_4a_api_36_1",
  "rq_pixel_7_api_36_1",
  "rq_pixel_8_pro_api_36_1",
  "rq_pixel_fold_outer_api_36_1",
  "rq_pixel_fold_unfolded_api_36_1",
  "rq_small_tablet_api_36_1",
  "rq_large_tablet_api_36_1",
  "rq_low_density_tablet_api_36_1"
)

function Fail($message) {
  throw "[android-emulator-compat] $message"
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

function Resolve-Aapt($sdkRoot) {
  $buildToolsRoot = Join-Path $sdkRoot "build-tools"
  if (-not (Test-Path $buildToolsRoot)) {
    Fail "Android build-tools directory not found under $sdkRoot."
  }

  $aapt = Get-ChildItem -Path $buildToolsRoot -Filter "aapt.exe" -Recurse |
    Sort-Object FullName -Descending |
    Select-Object -First 1

  if (-not $aapt) {
    Fail "aapt.exe not found under $buildToolsRoot."
  }

  return $aapt.FullName
}

function Resolve-Adb($sdkRoot) {
  $adb = Join-Path $sdkRoot "platform-tools\adb.exe"
  if (-not (Test-Path $adb)) {
    Fail "SDK-local adb.exe not found at $adb."
  }

  return $adb
}

function Invoke-EmulatorBuild {
  $androidDir = Resolve-Path "android"
  $gradlew = Join-Path $androidDir "gradlew.bat"
  if (-not (Test-Path $gradlew)) {
    Fail "Gradle wrapper not found at $gradlew."
  }

  Write-Host "Building emulator debug APK with reactNativeArchitectures=x86_64 (timeout ${TimeoutSeconds}s)..."
  $previousNodeEnv = $env:NODE_ENV
  $previousGradleUserHome = $env:GRADLE_USER_HOME
  $env:NODE_ENV = if ($env:NODE_ENV) { $env:NODE_ENV } else { "development" }
  $localGradleHome = Join-Path (Resolve-Path ".").Path ".gradle-local"
  New-Item -ItemType Directory -Path $localGradleHome -Force | Out-Null
  $env:GRADLE_USER_HOME = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { $localGradleHome }

  $stdout = Join-Path $env:TEMP "qwordly-gradle-emulator-build.out.log"
  $stderr = Join-Path $env:TEMP "qwordly-gradle-emulator-build.err.log"
  Remove-Item $stdout, $stderr -Force -ErrorAction SilentlyContinue

  $command = "`"$gradlew`" :app:assembleDebug -PreactNativeArchitectures=x86_64 --console=plain"
  $process = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList @("/d", "/c", $command) `
    -WorkingDirectory $androidDir `
    -NoNewWindow `
    -PassThru `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr

  try {
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
      & taskkill.exe /PID $process.Id /T /F | Out-Null
      Fail "Timed out after ${TimeoutSeconds}s while building emulator debug APK."
    }

    $process.Refresh()
    $stdoutContent = ""
    $stderrContent = ""
    if (Test-Path $stdout) {
      $stdoutContent = Get-Content $stdout -Raw
      Write-Host $stdoutContent
    }
    if (Test-Path $stderr) {
      $stderrContent = Get-Content $stderr -Raw
      Write-Host $stderrContent
    }

    $exitCode = $process.ExitCode
    if ($null -eq $exitCode -and $stdoutContent -match "BUILD SUCCESSFUL") {
      $exitCode = 0
    }

    if ($exitCode -ne 0) {
      Fail "Gradle build failed with exit code $exitCode."
    }
  } finally {
    if ($null -eq $previousNodeEnv) {
      Remove-Item Env:\NODE_ENV -ErrorAction SilentlyContinue
    } else {
      $env:NODE_ENV = $previousNodeEnv
    }

    if ($null -eq $previousGradleUserHome) {
      Remove-Item Env:\GRADLE_USER_HOME -ErrorAction SilentlyContinue
    } else {
      $env:GRADLE_USER_HOME = $previousGradleUserHome
    }
  }
}

function Get-AvdConfig($avdName) {
  $configPath = Join-Path $env:USERPROFILE ".android\avd\$avdName.avd\config.ini"
  if (-not (Test-Path $configPath)) {
    Fail "AVD config missing for $avdName at $configPath."
  }

  $config = @{}
  Get-Content $configPath | ForEach-Object {
    if ($_ -match "^([^=]+)=(.*)$") {
      $config[$matches[1]] = $matches[2]
    }
  }

  return $config
}

if ($Build) {
  Invoke-EmulatorBuild
}

$sdkRoot = Resolve-AndroidSdk
$aapt = Resolve-Aapt $sdkRoot
$adb = Resolve-Adb $sdkRoot
$resolvedApk = Resolve-Path $ApkPath -ErrorAction SilentlyContinue
if (-not $resolvedApk) {
  Fail "APK not found at $ApkPath. Run with -Build first."
}

$badging = & $aapt dump badging $resolvedApk.Path
$packageLine = $badging | Select-String -Pattern "^package:" | Select-Object -First 1
$activityLine = $badging | Select-String -Pattern "^launchable-activity:" | Select-Object -First 1
$nativeCodeLine = $badging | Select-String -Pattern "^native-code:" | Select-Object -First 1

if (-not $packageLine -or $packageLine.Line -notmatch "name='com\.roobsworld\.riddlequest'") {
  Fail "APK package id is not com.roobsworld.riddlequest. Package line: $($packageLine.Line)"
}

if (-not $activityLine -or $activityLine.Line -notmatch "com\.roobsworld\.riddlequest\.MainActivity") {
  Fail "APK launchable activity is not com.roobsworld.riddlequest.MainActivity. Activity line: $($activityLine.Line)"
}

if (-not $nativeCodeLine -or $nativeCodeLine.Line -notmatch "'x86_64'") {
  Fail "APK does not advertise x86_64 native code. Native-code line: $($nativeCodeLine.Line)"
}

$emulatorCommand = Get-Command emulator -ErrorAction SilentlyContinue
if (-not $emulatorCommand) {
  Fail "Android emulator command is not on PATH."
}

$availableAvds = & $emulatorCommand.Source -list-avds
$missingAvds = $expectedAvds | Where-Object { $_ -notin $availableAvds }
if ($missingAvds.Count -gt 0) {
  Fail "Missing expected AVDs: $($missingAvds -join ', ')"
}

$rows = foreach ($avd in $expectedAvds) {
  $config = Get-AvdConfig $avd
  $abi = $config["abi.type"]
  $image = $config["image.sysdir.1"]
  if ($abi -ne "x86_64") {
    Fail "$avd ABI is $abi, expected x86_64."
  }
  if ($image -notmatch "x86_64") {
    Fail "$avd system image is $image, expected an x86_64 image."
  }

  [pscustomobject]@{
    AVD = $avd
    ABI = $abi
    Image = $image
    Resolution = "$($config["hw.lcd.width"])x$($config["hw.lcd.height"])"
    Density = $config["hw.lcd.density"]
  }
}

$pathAdb = Get-Command adb -ErrorAction SilentlyContinue
if ($pathAdb -and ((Resolve-Path $pathAdb.Source).Path -ne (Resolve-Path $adb).Path)) {
  Write-Host "Warning: PATH adb differs from SDK adb. Using SDK adb at $adb for emulator QA checks."
}

$adbDevices = & $adb devices -l
$physicalDevices = $adbDevices | Select-String -Pattern "device " | Where-Object { $_.Line -notmatch "^emulator-" }
if ($physicalDevices) {
  Write-Host "Warning: physical Android devices are connected. Install QA APKs with adb -s emulator-<port> or an explicit Expo --device target."
}

Write-Host "APK: $($resolvedApk.Path)"
Write-Host $packageLine.Line
Write-Host $activityLine.Line
Write-Host $nativeCodeLine.Line
$rows | Format-Table -AutoSize
Write-Host "PASS: emulator APK and AVD matrix are ABI-compatible for x86_64 emulator QA."
