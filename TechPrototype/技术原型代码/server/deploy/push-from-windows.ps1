param(
  [string]$HostName = "10.119.5.83",
  [string]$User = "root"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$serverRoot = Join-Path $repoRoot "server"
$archive = Join-Path $env:TEMP "ueat-server-deploy.zip"
$staging = Join-Path $env:TEMP "ueat-server-deploy"

if (Test-Path $archive) {
  Remove-Item -LiteralPath $archive -Force
}

if (Test-Path $staging) {
  Remove-Item -LiteralPath $staging -Recurse -Force
}

New-Item -ItemType Directory -Path $staging | Out-Null
Copy-Item -LiteralPath $serverRoot -Destination $staging -Recurse

$stagedServer = Join-Path $staging "server"
Remove-Item -LiteralPath (Join-Path $stagedServer "node_modules") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $stagedServer "data\*.sqlite*") -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $stagedServer "data\*.sqlite-journal") -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $stagedServer "data\*.json") -Force -ErrorAction SilentlyContinue

Compress-Archive -Path (Join-Path $stagedServer "*") -DestinationPath $archive -Force

$remote = "${User}@${HostName}"

ssh $remote "mkdir -p /opt/ueat/server"
scp $archive "${remote}:/tmp/ueat-server-deploy.zip"
ssh $remote "mkdir -p /opt/ueat/server/data && find /opt/ueat/server -mindepth 1 -maxdepth 1 ! -name data ! -name node_modules -exec rm -rf {} + && unzip -o /tmp/ueat-server-deploy.zip -d /opt/ueat/server && bash /opt/ueat/server/deploy/install-ubuntu.sh && cd /opt/ueat/server && npm ci --omit=dev && bash /opt/ueat/server/deploy/activate-service.sh"

Write-Host "Deployed. Check: http://$HostName/api/health"
