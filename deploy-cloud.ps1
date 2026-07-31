param(
  [string]$HostName = "10.119.5.83",
  [string]$User = "root"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path $PSScriptRoot
$remote = "${User}@${HostName}"
$archive = Join-Path $env:TEMP "ueat-cloud-deploy.zip"
$staging = Join-Path $env:TEMP ("ueat-cloud-deploy-" + [guid]::NewGuid().ToString("N"))

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
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
Get-ChildItem -Path (Join-Path $stagedServer "deploy") -File | Where-Object {
  $_.Extension -in @(".sh", ".service", ".timer")
} | ForEach-Object {
  $content = [System.IO.File]::ReadAllText($_.FullName)
  $content = $content -replace "`r`n", "`n"
  $content = $content -replace "`r", "`n"
  [System.IO.File]::WriteAllText($_.FullName, $content, $utf8NoBom)
}

Remove-Item -LiteralPath (Join-Path $stagedServer "node_modules") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $stagedServer "data\*.sqlite*") -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $stagedServer "data\*.sqlite-journal") -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $stagedServer "data\*.json") -Force -ErrorAction SilentlyContinue

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $archive -Force

ssh $remote "mkdir -p /opt/ueat"
scp $archive "${remote}:/tmp/ueat-cloud-deploy.zip"
ssh $remote "mkdir -p /opt/ueat/server/data && rm -rf /opt/ueat/web && find /opt/ueat/server -mindepth 1 -maxdepth 1 ! -name data ! -name node_modules -exec rm -rf {} + && unzip -o /tmp/ueat-cloud-deploy.zip -d /opt/ueat && perl -pi -e 's/\r$//' /opt/ueat/server/deploy/*.sh /opt/ueat/server/deploy/*.service /opt/ueat/server/deploy/*.timer && find /opt/ueat/web/dist -type d -exec chmod 755 {} \; && find /opt/ueat/web/dist -type f -exec chmod 644 {} \; && bash /opt/ueat/server/deploy/install-ubuntu.sh && cd /opt/ueat/server && npm ci --omit=dev && DATABASE_URL='postgresql:///ueat?host=/var/run/postgresql' node dist/tools/migrateSqliteToPostgres.js && bash /opt/ueat/server/deploy/activate-service.sh && find /opt/ueat/web/dist -type d -exec chmod 755 {} \; && find /opt/ueat/web/dist -type f -exec chmod 644 {} \; && test ! -d /opt/ueat/web/dist/assets/vpet-prototype/frames || chmod 755 /opt/ueat/web/dist/assets/vpet-prototype/frames"
ssh $remote "systemctl restart ueat-server && systemctl is-active --quiet ueat-server"

$webUrl = "http://${HostName}/"
$healthUrl = "http://${HostName}/api/health"
$webResponse = Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 20
if ($webResponse.StatusCode -ne 200) {
  throw "Web health check failed with status $($webResponse.StatusCode)."
}

$healthResponse = $null
for ($attempt = 1; $attempt -le 20; $attempt++) {
  try {
    $candidate = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
    if ($candidate.success -and $candidate.data.status -eq "ok" -and $candidate.data.checks.database.status -eq "ok") {
      $healthResponse = $candidate
      break
    }
  }
  catch {
    if ($attempt -eq 20) {
      throw
    }
  }

  Start-Sleep -Seconds 1
}

if (-not $healthResponse) {
  throw "API health check failed."
}

Write-Host "Deployed:"
Write-Host "  Web: $webUrl (200)"
Write-Host "  API: $healthUrl ($($healthResponse.data.status))"
