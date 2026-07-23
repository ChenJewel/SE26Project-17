import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Router, type Request } from "express";
import { sendFailure, sendSuccess } from "../common/http.js";

type AppPlatform = "android";

type AppVersionConfig = {
  platform: AppPlatform;
  channel: string;
  latestVersionCode: number;
  latestVersionName: string;
  minSupportedVersionCode: number;
  forceUpdate: boolean;
  apkUrl: string;
  apkSha256: string;
  apkSizeBytes?: number;
  releaseNotes: string[];
  releasedAt: string;
  rolloutPercent: number;
  source?: "github" | "manifest" | "env";
};

type GitHubReleaseAsset = {
  id: number;
  name: string;
  size: number;
  url: string;
  browser_download_url: string;
  digest?: string;
  content_type?: string;
};

type GitHubRelease = {
  tag_name: string;
  target_commitish?: string;
  name?: string;
  body?: string;
  prerelease?: boolean;
  draft?: boolean;
  published_at?: string;
  assets: GitHubReleaseAsset[];
};

type GitHubWorkflowRunsResponse = {
  workflow_runs?: Array<{
    name?: string;
    head_sha?: string;
    run_number?: number;
    event?: string;
    conclusion?: string | null;
  }>;
};

type ManifestShape = {
  android?: Record<string, Partial<AppVersionConfig>>;
};

const defaultGitHubRepo = "ChenJewel/SE26Project-17";
const githubCache = new Map<string, { expiresAt: number; value: AppVersionConfig | null }>();
const defaultReleaseNotes = ["\u4f18\u5316\u4f53\u9a8c\u4e0e\u7a33\u5b9a\u6027\u3002"];

export const appVersionRouter = Router();

appVersionRouter.get("/version/latest", async (req, res) => {
  const platform = normalizePlatform(req.query.platform);
  if (!platform) {
    sendFailure(res, 400, "INVALID_PLATFORM", "Only android app updates are supported right now.");
    return;
  }

  const channel = normalizeChannel(req.query.channel);
  const currentVersionCode = readVersionCode(req.query.versionCode);
  const latest = await getLatestVersion(platform, channel, req);
  const hasDownload = Boolean(latest.apkUrl);
  const forceUpdate = hasDownload && (latest.forceUpdate || currentVersionCode < latest.minSupportedVersionCode);
  const updateAvailable = latest.latestVersionCode > 0 && currentVersionCode < latest.latestVersionCode;

  sendSuccess(res, {
    ...latest,
    forceUpdate,
    updateAvailable,
    currentVersionCode,
    downloadEnabled: hasDownload,
  });
});

appVersionRouter.get("/version/download/github/:assetId", async (req, res) => {
  const assetId = Number.parseInt(req.params.assetId, 10);
  if (!Number.isFinite(assetId) || assetId <= 0) {
    sendFailure(res, 400, "INVALID_ASSET", "Invalid GitHub release asset id.");
    return;
  }

  const repo = getGitHubRepo();
  if (!repo) {
    sendFailure(res, 404, "GITHUB_RELEASE_NOT_CONFIGURED", "GitHub release source is not configured.");
    return;
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/assets/${assetId}`, {
      headers: githubHeaders("application/octet-stream"),
    });

    if (!response.ok || !response.body) {
      sendFailure(res, response.status || 502, "GITHUB_ASSET_DOWNLOAD_FAILED", "Failed to download GitHub release asset.");
      return;
    }

    res.setHeader("Content-Type", response.headers.get("content-type") || "application/vnd.android.package-archive");
    const disposition = response.headers.get("content-disposition");
    if (disposition) res.setHeader("Content-Disposition", disposition);
    const length = response.headers.get("content-length");
    if (length) res.setHeader("Content-Length", length);
    await pipeline(Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]), res);
  } catch (error) {
    console.warn("Failed to proxy GitHub APK asset.", error);
    if (!res.headersSent) sendFailure(res, 502, "GITHUB_ASSET_DOWNLOAD_FAILED", "Failed to download GitHub release asset.");
  }
});

function normalizePlatform(value: unknown): AppPlatform | null {
  const platform = typeof value === "string" ? value.trim().toLowerCase() : "android";
  return platform === "android" ? "android" : null;
}

function normalizeChannel(value: unknown) {
  const channel = typeof value === "string" ? value.trim().toLowerCase() : "";
  return channel || "official";
}

function readVersionCode(value: unknown) {
  if (typeof value !== "string") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function getLatestVersion(platform: AppPlatform, channel: string, req: Request) {
  const envVersion = readEnvVersion(platform, channel, req);
  const manifestVersion = readManifestVersion(platform, channel);
  const fallbackVersion = {
    ...envVersion,
    ...manifestVersion,
    platform,
    channel,
    source: Object.keys(manifestVersion).length ? "manifest" as const : "env" as const,
  };

  if ((process.env.APP_VERSION_SOURCE ?? "github").trim().toLowerCase() === "local") return fallbackVersion;

  const githubVersion = await readGitHubVersion(platform, channel, req);
  return githubVersion ?? fallbackVersion;
}

async function readGitHubVersion(platform: AppPlatform, channel: string, req: Request): Promise<AppVersionConfig | null> {
  const repo = getGitHubRepo();
  if (!repo) return null;

  const cacheKey = `${repo}:${platform}:${channel}`;
  const cached = githubCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const release = await fetchLatestGitHubRelease(repo);
    const version = release ? await mapGitHubReleaseToVersion(release, repo, platform, channel, req) : null;
    githubCache.set(cacheKey, { value: version, expiresAt: Date.now() + readEnvNumber("APP_GITHUB_CACHE_TTL_MS", 300000, 30000) });
    return version;
  } catch (error) {
    console.warn("Failed to read GitHub latest release.", error);
    githubCache.set(cacheKey, { value: null, expiresAt: Date.now() + 60000 });
    return null;
  }
}

async function fetchLatestGitHubRelease(repo: string) {
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: githubHeaders(),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub latest release failed: ${response.status}`);
  return await response.json() as GitHubRelease;
}

async function mapGitHubReleaseToVersion(
  release: GitHubRelease,
  repo: string,
  platform: AppPlatform,
  channel: string,
  req: Request
): Promise<AppVersionConfig | null> {
  if (release.draft || release.prerelease && !readEnvBoolean("APP_GITHUB_INCLUDE_PRERELEASE", false)) return null;

  const apkAsset = pickApkAsset(release.assets);
  if (!apkAsset) return null;

  const tagVersion = parseTagVersion(release.tag_name);
  if (!tagVersion) return null;

  const metadata = await readGitHubMetadataAsset(repo, release.assets);
  const workflowRunVersionCode = await readGitHubWorkflowRunVersionCode(repo, release);
  const apkSha256 = normalizeDigest(apkAsset.digest) || readString(metadata.apkSha256);
  const forceUpdate = typeof metadata.forceUpdate === "boolean" ? metadata.forceUpdate : readEnvBoolean("APP_ANDROID_FORCE_UPDATE", false);
  const latestVersionCode = readPositiveNumber(metadata.versionCode) || workflowRunVersionCode || tagVersion.versionCode;
  const latestVersionName = readString(metadata.versionName) || tagVersion.versionName;

  return {
    platform,
    channel,
    latestVersionCode,
    latestVersionName,
    minSupportedVersionCode: readPositiveNumber(metadata.minSupportedVersionCode) || readEnvNumber("APP_ANDROID_MIN_SUPPORTED_VERSION_CODE", forceUpdate ? latestVersionCode : 0),
    forceUpdate,
    apkUrl: shouldProxyGitHubAsset() ? buildAbsoluteUrl(req, `/app/version/download/github/${apkAsset.id}`) : apkAsset.browser_download_url,
    apkSha256,
    apkSizeBytes: apkAsset.size,
    releaseNotes: readReleaseNotesFromGitHub(release.body, metadata.releaseNotes),
    releasedAt: release.published_at || new Date(0).toISOString(),
    rolloutPercent: readPositiveNumber(metadata.rolloutPercent) || readEnvNumber("APP_ANDROID_ROLLOUT_PERCENT", 100, 0, 100),
    source: "github",
  };
}

async function readGitHubWorkflowRunVersionCode(repo: string, release: GitHubRelease) {
  if ((process.env.APP_GITHUB_LEGACY_VERSION_CODE_SOURCE ?? "workflow-run").trim().toLowerCase() !== "workflow-run") return 0;
  const headSha = release.target_commitish?.trim();
  if (!headSha || !/^[0-9a-f]{40}$/i.test(headSha)) return 0;

  try {
    const query = new URLSearchParams({
      event: "push",
      status: "success",
      head_sha: headSha,
      per_page: "20",
    });
    const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs?${query.toString()}`, {
      headers: githubHeaders(),
    });
    if (!response.ok) return 0;
    const payload = await response.json() as GitHubWorkflowRunsResponse;
    const run = payload.workflow_runs?.find((item) =>
      item.name === "Android Release APK" &&
      item.head_sha === headSha &&
      item.conclusion === "success" &&
      typeof item.run_number === "number"
    );
    return run?.run_number && run.run_number > 0 ? Math.floor(run.run_number) : 0;
  } catch (error) {
    console.warn("Failed to read GitHub workflow run number.", error);
    return 0;
  }
}

function pickApkAsset(assets: GitHubReleaseAsset[]) {
  const patternText = process.env.APP_GITHUB_APK_ASSET_PATTERN?.trim() || "\\.apk$";
  const pattern = new RegExp(patternText, "i");
  return assets.find((asset) => pattern.test(asset.name) && asset.name.toLowerCase().endsWith(".apk")) ?? null;
}

async function readGitHubMetadataAsset(repo: string, assets: GitHubReleaseAsset[]) {
  const metadataAsset = assets.find((asset) => /^app-version\.json$/i.test(asset.name));
  if (!metadataAsset) return {};

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/assets/${metadataAsset.id}`, {
      headers: githubHeaders("application/octet-stream"),
    });
    if (!response.ok) return {};
    const text = await response.text();
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Failed to read GitHub app-version.json asset.", error);
    return {};
  }
}

function parseTagVersion(tag: string) {
  const match = tag.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i);
  if (!match) return null;
  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = Number.parseInt(match[3], 10);
  if (![major, minor, patch].every(Number.isFinite)) return null;
  return {
    versionName: `${major}.${minor}.${patch}`,
    versionCode: major * 1000000 + minor * 1000 + patch,
  };
}

function getGitHubRepo() {
  const repo = (process.env.APP_GITHUB_REPOSITORY || process.env.GITHUB_REPOSITORY || defaultGitHubRepo).trim();
  return /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : "";
}

function githubHeaders(accept = "application/vnd.github+json") {
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "ueat-app-version-checker",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.APP_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function shouldProxyGitHubAsset() {
  const mode = process.env.APP_GITHUB_DOWNLOAD_MODE?.trim().toLowerCase();
  if (mode === "direct") return false;
  if (mode === "proxy") return true;
  return Boolean(process.env.APP_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim());
}

function readManifestVersion(platform: AppPlatform, channel: string): Partial<AppVersionConfig> {
  const manifestPath = process.env.APP_VERSION_MANIFEST_PATH?.trim();
  if (!manifestPath) return {};

  const resolvedPath = isAbsolute(manifestPath) ? manifestPath : resolve(process.cwd(), manifestPath);
  if (!existsSync(resolvedPath)) return {};

  try {
    const manifest = JSON.parse(readFileSync(resolvedPath, "utf8")) as ManifestShape;
    return manifest[platform]?.[channel] ?? manifest[platform]?.official ?? {};
  } catch (error) {
    console.warn("Failed to read app version manifest.", error);
    return {};
  }
}

function readEnvVersion(platform: AppPlatform, channel: string, req: Request): AppVersionConfig {
  const latestVersionCode = readEnvNumber("APP_ANDROID_LATEST_VERSION_CODE", 0);
  const forceUpdate = readEnvBoolean("APP_ANDROID_FORCE_UPDATE", false);
  const apkUrl = normalizeDownloadUrl(process.env.APP_ANDROID_APK_URL ?? "", req);
  return {
    platform,
    channel,
    latestVersionCode,
    latestVersionName: process.env.APP_ANDROID_LATEST_VERSION_NAME?.trim() || (latestVersionCode ? `1.0.${latestVersionCode}` : "0.0.0"),
    minSupportedVersionCode: readEnvNumber("APP_ANDROID_MIN_SUPPORTED_VERSION_CODE", forceUpdate ? latestVersionCode : 0),
    forceUpdate,
    apkUrl,
    apkSha256: process.env.APP_ANDROID_APK_SHA256?.trim() ?? "",
    apkSizeBytes: readOptionalEnvNumber("APP_ANDROID_APK_SIZE_BYTES"),
    releaseNotes: readReleaseNotes(),
    releasedAt: process.env.APP_ANDROID_RELEASED_AT?.trim() || new Date(0).toISOString(),
    rolloutPercent: readEnvNumber("APP_ANDROID_ROLLOUT_PERCENT", 100, 0, 100),
    source: "env",
  };
}

function readReleaseNotes() {
  const raw = process.env.APP_ANDROID_RELEASE_NOTES?.trim();
  if (!raw) return defaultReleaseNotes;
  return raw.split(/\n|\|/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function readReleaseNotesFromGitHub(body: string | undefined, metadataNotes: unknown) {
  if (Array.isArray(metadataNotes)) {
    const notes = metadataNotes.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean).slice(0, 8);
    if (notes.length) return notes;
  }

  const notes = (body ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter((line) => line && !line.startsWith("#"))
    .slice(0, 8);
  if (!notes.length) return defaultReleaseNotes;
  return notes;
}

function readEnvNumber(key: string, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(process.env[key] ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function readOptionalEnvNumber(key: string) {
  const value = process.env[key];
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readEnvBoolean(key: string, fallback: boolean) {
  const value = process.env[key]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveNumber(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : 0;
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function normalizeDigest(value: string | undefined) {
  const digest = value?.trim() ?? "";
  return digest.toLowerCase().startsWith("sha256:") ? digest.slice("sha256:".length) : digest;
}

function normalizeDownloadUrl(value: string, req: Request) {
  const url = value.trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  const baseUrl = process.env.APP_DOWNLOAD_BASE_URL?.trim();
  if (baseUrl) return `${baseUrl.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;

  return buildAbsoluteUrl(req, url);
}

function buildAbsoluteUrl(req: Request, path: string) {
  const protocol = req.header("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol;
  const host = req.header("x-forwarded-host") || req.header("host") || "";
  return host ? `${protocol}://${host}/${path.replace(/^\/+/, "")}` : path;
}
