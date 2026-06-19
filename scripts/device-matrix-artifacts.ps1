function ConvertTo-ArchiveSegment([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return "unknown"
  }

  $segment = $Value.Trim()
  $segment = $segment -replace '[<>:"/\\|?*]', '-'
  $segment = $segment -replace '\s+', '-'
  $segment = $segment.Trim('.')

  if ([string]::IsNullOrWhiteSpace($segment)) {
    return "unknown"
  }

  return $segment
}

function Get-DeviceMatrixArchiveRoot([string]$WorkspaceRoot) {
  return Join-Path $WorkspaceRoot "device-matrix-test"
}

function Get-DeviceMatrixDateFolder([datetime]$CaptureDate) {
  return $CaptureDate.ToString("dd-MM-yyyy")
}

function Get-DeviceMatrixRunRoot([string]$WorkspaceRoot, [datetime]$CaptureDate, [string]$DeviceName) {
  $archiveRoot = Get-DeviceMatrixArchiveRoot $WorkspaceRoot
  $dateFolder = Get-DeviceMatrixDateFolder $CaptureDate
  $deviceFolder = ConvertTo-ArchiveSegment $DeviceName
  return Join-Path (Join-Path $archiveRoot $dateFolder) $deviceFolder
}

function Get-DeviceMatrixImageDir([string]$WorkspaceRoot, [datetime]$CaptureDate, [string]$DeviceName) {
  return Join-Path (Get-DeviceMatrixRunRoot $WorkspaceRoot $CaptureDate $DeviceName) "images"
}

function Get-DeviceMatrixLogDir([string]$WorkspaceRoot, [datetime]$CaptureDate, [string]$DeviceName) {
  return Join-Path (Get-DeviceMatrixRunRoot $WorkspaceRoot $CaptureDate $DeviceName) "logs"
}

function New-DeviceMatrixArtifactDirs([string]$WorkspaceRoot, [datetime]$CaptureDate, [string]$DeviceName) {
  $imageDir = Get-DeviceMatrixImageDir $WorkspaceRoot $CaptureDate $DeviceName
  $logDir = Get-DeviceMatrixLogDir $WorkspaceRoot $CaptureDate $DeviceName

  New-Item -ItemType Directory -Path $imageDir, $logDir -Force | Out-Null

  return [pscustomobject]@{
    Root = Get-DeviceMatrixRunRoot $WorkspaceRoot $CaptureDate $DeviceName
    ImageDir = $imageDir
    LogDir = $logDir
  }
}
