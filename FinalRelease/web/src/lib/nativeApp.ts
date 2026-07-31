import { runtimeConfig } from "@/config/runtime";
import type { AppUpdateDownloadPayload, NativeAppInfo } from "@/types/appUpdate";

type NativeBridge = {
  getAppInfo?: () => NativeAppInfo | Partial<NativeAppInfo> | string | Promise<NativeAppInfo | Partial<NativeAppInfo> | string>;
  getVersionCode?: () => number | string | Promise<number | string>;
  getVersionName?: () => string | Promise<string>;
  getChannel?: () => string | Promise<string>;
  downloadAndInstallApk?: (payload: AppUpdateDownloadPayload | string) => void | boolean | Promise<void | boolean>;
};

declare global {
  interface Window {
    UeatNative?: NativeBridge;
    NativeApp?: NativeBridge;
  }
}

const defaultChannel = "official";

export async function getNativeAppInfo(): Promise<NativeAppInfo> {
  const bridge = getNativeBridge();
  if (bridge?.getAppInfo) {
    const info = await bridge.getAppInfo();
    return normalizeAppInfo(parseBridgeValue(info), true);
  }

  const capacitorInfo = await getCapacitorAppInfo();
  if (capacitorInfo) return capacitorInfo;

  const [rawVersionCode, versionName, channel] = await Promise.all([
    bridge?.getVersionCode?.(),
    bridge?.getVersionName?.(),
    bridge?.getChannel?.(),
  ]);

  const versionCode = typeof rawVersionCode === "string" ? Number.parseInt(rawVersionCode, 10) : rawVersionCode;
  return normalizeAppInfo({ versionCode, versionName, channel }, Boolean(bridge));
}

export async function requestNativeApkInstall(payload: AppUpdateDownloadPayload) {
  const bridge = getNativeBridge();
  if (bridge?.downloadAndInstallApk) {
    await bridge.downloadAndInstallApk(JSON.stringify(payload));
    return true;
  }

  if (payload.apkUrl) {
    window.open(payload.apkUrl, "_blank", "noopener,noreferrer");
    return false;
  }

  return false;
}

export function hasNativeAppBridge() {
  return Boolean(getNativeBridge());
}

function getNativeBridge() {
  if (typeof window === "undefined") return null;
  return window.UeatNative ?? window.NativeApp ?? null;
}

async function getCapacitorAppInfo(): Promise<NativeAppInfo | null> {
  if (typeof window === "undefined") return null;

  try {
    const [{ Capacitor }, { App }] = await Promise.all([
      import("@capacitor/core"),
      import("@capacitor/app"),
    ]);
    if (!Capacitor.isNativePlatform()) return null;
    const info = await App.getInfo();
    return normalizeAppInfo({
      platform: "android",
      versionCode: Number.parseInt(info.build, 10),
      versionName: info.version,
      channel: defaultChannel,
    }, false);
  } catch {
    return null;
  }
}

function normalizeAppInfo(info: Partial<NativeAppInfo> | undefined, hasNativeBridge: boolean): NativeAppInfo {
  const fallbackVersionCode = Number.parseInt(import.meta.env.VITE_APP_VERSION_CODE || "0", 10);
  const versionCode = Number(info?.versionCode);
  const platform = info?.platform === "android" || runtimeConfig.isPackagedApp ? "android" : "web";
  return {
    platform,
    versionCode: Number.isFinite(versionCode) && versionCode > 0
      ? Math.floor(versionCode)
      : Number.isFinite(fallbackVersionCode) && fallbackVersionCode > 0
        ? fallbackVersionCode
        : 0,
    versionName: typeof info?.versionName === "string" && info.versionName.trim()
      ? info.versionName.trim()
      : import.meta.env.VITE_APP_VERSION_NAME || "Web",
    channel: typeof info?.channel === "string" && info.channel.trim() ? info.channel.trim().toLowerCase() : defaultChannel,
    hasNativeBridge,
  };
}

function parseBridgeValue(value: NativeAppInfo | Partial<NativeAppInfo> | string | undefined) {
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value) as Partial<NativeAppInfo>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
