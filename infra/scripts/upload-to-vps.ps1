param(
  [Parameter(Mandatory = $true)]
  [string]$VpsHost,

  [string]$VpsUser = "ubuntu",

  [Parameter(Mandatory = $true)]
  [string]$SshKey,

  [Parameter(Mandatory = $true)]
  [string]$LocalPath,

  [int]$SshPort = 22,

  [string]$VpsUploadDir = "",

  [switch]$UseRsync
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $LocalPath)) {
  throw "LocalPath does not exist: $LocalPath"
}

if (-not (Test-Path -LiteralPath $SshKey)) {
  throw "SshKey does not exist: $SshKey"
}

if ([string]::IsNullOrWhiteSpace($VpsUploadDir)) {
  $VpsUploadDir = "/home/$VpsUser/ai-media-uploads"
}

$sshTarget = "$VpsUser@$VpsHost"
$sshBaseArgs = @(
  "-i", $SshKey,
  "-p", "$SshPort",
  "-o", "StrictHostKeyChecking=accept-new"
)

Write-Host "Preparing upload directory on VPS..."
ssh @sshBaseArgs $sshTarget "mkdir -p '$VpsUploadDir' && chmod 755 '$VpsUploadDir'"

if ($UseRsync) {
  $rsync = Get-Command rsync -ErrorAction SilentlyContinue
  if (-not $rsync) {
    throw "rsync is not installed locally. Use scp mode by omitting -UseRsync."
  }

  Write-Host "Uploading with rsync..."
  rsync -avz -e "ssh -i `"$SshKey`" -p $SshPort -o StrictHostKeyChecking=accept-new" $LocalPath "${sshTarget}:${VpsUploadDir}/"
} else {
  Write-Host "Uploading with scp..."
  if (Test-Path -LiteralPath $LocalPath -PathType Container) {
    scp @sshBaseArgs -r $LocalPath "${sshTarget}:${VpsUploadDir}/"
  } else {
    scp @sshBaseArgs $LocalPath "${sshTarget}:${VpsUploadDir}/"
  }
}

$name = Split-Path -Leaf $LocalPath
Write-Host "Upload complete."
Write-Host "Remote path: ${sshTarget}:${VpsUploadDir}/$name"
