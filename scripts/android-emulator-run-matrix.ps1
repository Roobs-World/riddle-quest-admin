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
  [switch]$SkipMetroAssetProbe,
  [switch]$ProbeOnly
)

$ErrorActionPreference = "Stop"

function Fail($message) {
  throw "[android-emulator-run-matrix] $message"
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

  if ($ProbeOnly) {
    Test-MetroAssetPath $adb
    return
  }

  foreach ($avd in $AvdNames) {
    Write-Host "Running Android matrix target $avd..."
    $target = Start-MatrixAvd $adb $emulator $avd

    try {
      $reuseExistingMetro = Assert-PortAvailableOrMetro
      $expoArgs = @("exec", "expo", "run:android", "--device", $avd)
      if ($reuseExistingMetro) {
        Write-Host "Reusing existing Metro server on localhost:$Port for $avd."
        $expoArgs += "--no-bundler"
      } else {
        $expoArgs += @("--port", "$Port")
      }

      & pnpm @expoArgs
      if ($LASTEXITCODE -ne 0) {
        Fail "expo run:android failed for $avd ($($target.Serial)) with exit code $LASTEXITCODE."
      }

      if (-not $SkipMetroAssetProbe) {
        Test-MetroAssetPath $adb $target.Serial
      }
    } finally {
      Stop-MatrixAvd $adb $target
    }
  }

  Write-Host "PASS: Android emulator run matrix completed."
} finally {
  Restore-EnvVar "REACT_NATIVE_PACKAGER_HOSTNAME" $previousReactNativePackagerHostname
  Restore-EnvVar "EXPO_PACKAGER_PROXY_URL" $previousExpoPackagerProxyUrl
  Restore-EnvVar "GRADLE_USER_HOME" $previousGradleUserHome
}
