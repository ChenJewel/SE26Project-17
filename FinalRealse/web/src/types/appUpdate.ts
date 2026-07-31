export type AppPlatform = "android" | "web";

export type NativeAppInfo = {
  platform: AppPlatform;
  versionCode: number;
  versionName: string;
  channel: string;
  hasNativeBridge: boolean;
};

export type AppVersionInfo = {
  platform: "android";
  channel: string;
  currentVersionCode: number;
  latestVersionCode: number;
  latestVersionName: string;
  minSupportedVersionCode: number;
  forceUpdate: boolean;
  updateAvailable: boolean;
  downloadEnabled: boolean;
  apkUrl: string;
  apkSha256: string;
  apkSizeBytes?: number;
  releaseNotes: string[];
  releasedAt: string;
  rolloutPercent: number;
};

export type AppUpdateCheckResult = {
  appInfo: NativeAppInfo;
  version: AppVersionInfo | null;
  updateAvailable: boolean;
  forceUpdate: boolean;
  canInstallFromApp: boolean;
};

export type AppUpdateDownloadPayload = {
  apkUrl: string;
  apkSha256: string;
  versionCode: number;
  versionName: string;
  releaseNotes: string[];
};
