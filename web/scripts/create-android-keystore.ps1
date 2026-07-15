$ErrorActionPreference = "Stop"

$keystorePath = Join-Path $PSScriptRoot "..\android\app\ueat-release.jks"
$keystorePath = [System.IO.Path]::GetFullPath($keystorePath)
$alias = "ueat"

if (Test-Path $keystorePath) {
  throw "Keystore already exists: $keystorePath"
}

$storePassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$keyPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

keytool `
  -genkeypair `
  -v `
  -keystore $keystorePath `
  -storetype JKS `
  -alias $alias `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -storepass $storePassword `
  -keypass $keyPassword `
  -dname "CN=ueat, OU=ueat, O=ueat, L=Unknown, S=Unknown, C=CN"

$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($keystorePath))

Write-Host ""
Write-Host "Keystore created: $keystorePath"
Write-Host ""
Write-Host "Add these GitHub Secrets:"
Write-Host "ANDROID_KEYSTORE_BASE64=$base64"
Write-Host "ANDROID_KEYSTORE_PASSWORD=$storePassword"
Write-Host "ANDROID_KEY_ALIAS=$alias"
Write-Host "ANDROID_KEY_PASSWORD=$keyPassword"
Write-Host ""
Write-Host "Keep the .jks file and passwords safe. Future upgrades must use the same keystore."
