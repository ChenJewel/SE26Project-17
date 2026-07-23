#!/usr/bin/env bash
set -euo pipefail

REPO="${APP_GITHUB_REPOSITORY:-ChenJewel/SE26Project-17}"
CHANNEL="${APP_ANDROID_RELEASE_CHANNEL:-official}"
DOWNLOAD_DIR="${APP_ANDROID_RELEASE_DOWNLOAD_DIR:-/opt/ueat/downloads}"
BASE_URL="${APP_DOWNLOAD_BASE_URL:-http://10.119.5.83}"
API_URL="https://api.github.com/repos/${REPO}/releases/latest"
USER_AGENT="ueat-android-release-sync"

mkdir -p "${DOWNLOAD_DIR}"
chmod 755 "${DOWNLOAD_DIR}"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

curl_headers=(-H "User-Agent: ${USER_AGENT}" -H "Accept: application/vnd.github+json")
if [[ -n "${APP_GITHUB_TOKEN:-}" ]]; then
  curl_headers+=(-H "Authorization: Bearer ${APP_GITHUB_TOKEN}")
fi

release_json="${tmp_dir}/release.json"
metadata_json="${tmp_dir}/app-version.json"
asset_info_json="${tmp_dir}/asset-info.json"

curl -fsSL --connect-timeout 20 --retry 3 --retry-delay 5 "${curl_headers[@]}" "${API_URL}" -o "${release_json}"

node --input-type=module - "${release_json}" "${asset_info_json}" <<'NODE'
import { readFileSync, writeFileSync } from "node:fs";

const [, , releasePath, outPath] = process.argv;
const release = JSON.parse(readFileSync(releasePath, "utf8"));
if (release.draft || release.prerelease) {
  throw new Error(`Latest release ${release.tag_name ?? ""} is draft or prerelease.`);
}

const assets = Array.isArray(release.assets) ? release.assets : [];
const apk = assets.find((asset) => /\.apk$/i.test(asset.name ?? ""));
const metadata = assets.find((asset) => /^app-version\.json$/i.test(asset.name ?? ""));
const sha = apk ? assets.find((asset) => asset.name === `${apk.name}.sha256` || /\.apk\.sha256$/i.test(asset.name ?? "")) : null;

if (!apk) throw new Error("No APK asset found in latest GitHub Release.");
if (!metadata) throw new Error("No app-version.json asset found in latest GitHub Release.");

writeFileSync(outPath, JSON.stringify({
  tagName: release.tag_name,
  publishedAt: release.published_at,
  apk: {
    name: apk.name,
    size: apk.size,
    url: apk.browser_download_url,
  },
  metadata: {
    name: metadata.name,
    url: metadata.browser_download_url,
  },
  sha: sha ? {
    name: sha.name,
    url: sha.browser_download_url,
  } : null,
}, null, 2));
NODE

apk_name="$(node --input-type=module - "${asset_info_json}" <<'NODE'
import { readFileSync } from "node:fs";
const info = JSON.parse(readFileSync(process.argv[2], "utf8"));
process.stdout.write(info.apk.name);
NODE
)"

metadata_url="$(node --input-type=module - "${asset_info_json}" <<'NODE'
import { readFileSync } from "node:fs";
const info = JSON.parse(readFileSync(process.argv[2], "utf8"));
process.stdout.write(info.metadata.url);
NODE
)"

curl -fsSL --connect-timeout 20 --retry 3 --retry-delay 5 -H "User-Agent: ${USER_AGENT}" -L "${metadata_url}" -o "${metadata_json}"

latest_version_code="$(node --input-type=module - "${metadata_json}" <<'NODE'
import { readFileSync } from "node:fs";
const metadata = JSON.parse(readFileSync(process.argv[2], "utf8"));
const versionCode = Number.parseInt(String(metadata.versionCode ?? "0"), 10);
if (!Number.isFinite(versionCode) || versionCode <= 0) {
  throw new Error("app-version.json does not contain a valid versionCode.");
}
process.stdout.write(String(versionCode));
NODE
)"

current_manifest="${DOWNLOAD_DIR}/app-version-manifest.json"
current_version_code="0"
if [[ -f "${current_manifest}" ]]; then
  current_version_code="$(node --input-type=module - "${current_manifest}" "${CHANNEL}" <<'NODE'
import { readFileSync } from "node:fs";
const [, , manifestPath, channel] = process.argv;
try {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""));
  const version = manifest.android?.[channel] ?? manifest.android?.official ?? {};
  process.stdout.write(String(Number.parseInt(String(version.latestVersionCode ?? "0"), 10) || 0));
} catch {
  process.stdout.write("0");
}
NODE
)"
fi

if [[ "${current_version_code}" -ge "${latest_version_code}" && -f "${DOWNLOAD_DIR}/${apk_name}" ]]; then
  echo "Android release mirror already up to date: ${latest_version_code}."
  exit 0
fi

apk_url="$(node --input-type=module - "${asset_info_json}" <<'NODE'
import { readFileSync } from "node:fs";
const info = JSON.parse(readFileSync(process.argv[2], "utf8"));
process.stdout.write(info.apk.url);
NODE
)"

sha_url="$(node --input-type=module - "${asset_info_json}" <<'NODE'
import { readFileSync } from "node:fs";
const info = JSON.parse(readFileSync(process.argv[2], "utf8"));
process.stdout.write(info.sha?.url ?? "");
NODE
)"

apk_pending="${DOWNLOAD_DIR}/${apk_name}.pending"
sha_path="${DOWNLOAD_DIR}/${apk_name}.sha256"
sha_pending="${sha_path}.pending"
manifest_pending="${DOWNLOAD_DIR}/app-version-manifest.json.pending"

echo "Mirroring Android release ${latest_version_code}: ${apk_name}"
curl -fsSL --connect-timeout 30 --retry 3 --retry-delay 5 -H "User-Agent: ${USER_AGENT}" -L "${apk_url}" -o "${apk_pending}"

if [[ -n "${sha_url}" ]]; then
  curl -fsSL --connect-timeout 20 --retry 3 --retry-delay 5 -H "User-Agent: ${USER_AGENT}" -L "${sha_url}" -o "${sha_pending}"
else
  sha256sum "${apk_pending}" > "${sha_pending}"
fi

node --input-type=module - "${metadata_json}" "${asset_info_json}" "${manifest_pending}" "${apk_pending}" "${sha_pending}" "${CHANNEL}" <<'NODE'
import { statSync, readFileSync, writeFileSync } from "node:fs";

const [, , metadataPath, assetInfoPath, outPath, apkPath, shaPath, channel] = process.argv;
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const info = JSON.parse(readFileSync(assetInfoPath, "utf8"));
const shaText = readFileSync(shaPath, "utf8").trim();
const shaFromFile = shaText.match(/[a-f0-9]{64}/i)?.[0]?.toLowerCase() ?? "";

const releaseNotes = Array.isArray(metadata.releaseNotes) && metadata.releaseNotes.length
  ? metadata.releaseNotes
  : [`Android APK for ueat ${info.tagName}.`];

const manifest = {
  android: {
    [channel]: {
      latestVersionCode: Number(metadata.versionCode),
      latestVersionName: String(metadata.versionName ?? info.tagName.replace(/^v/i, "")),
      minSupportedVersionCode: Number(metadata.minSupportedVersionCode ?? 1),
      forceUpdate: Boolean(metadata.forceUpdate),
      apkUrl: `/downloads/${info.apk.name}`,
      apkSha256: String(metadata.apkSha256 ?? shaFromFile),
      apkSizeBytes: Number(metadata.apkSizeBytes ?? statSync(apkPath).size),
      releaseNotes,
      releasedAt: info.publishedAt ?? new Date().toISOString(),
      rolloutPercent: Number(metadata.rolloutPercent ?? 100),
    },
  },
};

writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

mv "${apk_pending}" "${DOWNLOAD_DIR}/${apk_name}"
mv "${sha_pending}" "${sha_path}"
mv "${manifest_pending}" "${current_manifest}"
chmod 644 "${DOWNLOAD_DIR}/${apk_name}" "${sha_path}" "${current_manifest}"

systemctl restart ueat-server || true
echo "Android release mirror updated to ${latest_version_code}: ${BASE_URL%/}/downloads/${apk_name}"
