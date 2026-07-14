param(
  [string]$HostName = "10.119.5.83",
  [string]$User = "root"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path $PSScriptRoot
$remote = "${User}@${HostName}"
$archive = Join-Path $env:TEMP "ueat-cloud-deploy.zip"
$staging = Join-Path $env:TEMP "ueat-cloud-deploy"

if (Test-Path $archive) {
  Remove-Item -LiteralPath $archive -Force
}

if (Test-Path $staging) {
  Remove-Item -LiteralPath $staging -Recurse -Force
}

Push-Location (Join-Path $repoRoot "web")
try {
  $env:VITE_API_BASE_URL = "http://${HostName}/api"
  $env:VITE_WS_URL = "ws://${HostName}"
  $env:VITE_APP_TARGET = "web"
  npm.cmd run build
}
finally {
  Pop-Location
}

Push-Location (Join-Path $repoRoot "server")
try {
  npm.cmd run check
  npm.cmd run build
}
finally {
  Pop-Location
}

New-Item -ItemType Directory -Path $staging | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "server") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "web") | Out-Null

Copy-Item -LiteralPath (Join-Path $repoRoot "server") -Destination $staging -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "web\dist") -Destination (Join-Path $staging "web") -Recurse -Force

$stagedServer = Join-Path $staging "server"
Remove-Item -LiteralPath (Join-Path $stagedServer "node_modules") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $stagedServer "data\*.sqlite*") -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $stagedServer "data\*.sqlite-journal") -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $stagedServer "data\*.json") -Force -ErrorAction SilentlyContinue

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $archive -Force

ssh $remote "mkdir -p /opt/ueat"
scp $archive "${remote}:/tmp/ueat-cloud-deploy.zip"
ssh $remote "mkdir -p /opt/ueat/server/data && rm -rf /opt/ueat/web && find /opt/ueat/server -mindepth 1 -maxdepth 1 ! -name data ! -name node_modules -exec rm -rf {} + && unzip -o /tmp/ueat-cloud-deploy.zip -d /opt/ueat && bash /opt/ueat/server/deploy/install-ubuntu.sh && cd /opt/ueat/server && npm ci --omit=dev && DATABASE_URL='postgresql:///ueat?host=/var/run/postgresql' node dist/tools/migrateSqliteToPostgres.js && bash /opt/ueat/server/deploy/activate-service.sh"

Write-Host "Deployed:"
Write-Host "  Web: http://${HostName}/"
Write-Host "  API: http://${HostName}/api/health"
