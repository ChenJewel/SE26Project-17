import { useCallback, useEffect, useMemo, useState } from "react";
import { runtimeConfig } from "@/config/runtime";
import { getNativeAppInfo, requestNativeApkInstall } from "@/lib/nativeApp";
import { fetchLatestAppVersion } from "@/services/appUpdateApi";
import type { AppUpdateCheckResult, AppUpdateDownloadPayload, AppVersionInfo, NativeAppInfo } from "@/types/appUpdate";

const dismissedUpdateKey = "ueat-app-update-dismissed-version";
const autoCheckedKey = "ueat-app-update-auto-checked-session";

export function useAppUpdatePrompt(enabled: boolean) {
  const [result, setResult] = useState<AppUpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState("");

  const shouldAutoCheck = useMemo(() => enabled && (runtimeConfig.isPackagedApp || typeof window !== "undefined"), [enabled]);

  const checkForUpdate = useCallback(async (manual = false) => {
    setNotice("");
    const appInfo = await getNativeAppInfo();
    const canCheckApk = appInfo.platform === "android" && (appInfo.hasNativeBridge || appInfo.versionCode > 0);

    if (!canCheckApk) {
      const webResult: AppUpdateCheckResult = {
        appInfo,
        version: null,
        updateAvailable: false,
        forceUpdate: false,
        canInstallFromApp: false,
      };
      if (manual) setResult(webResult);
      return webResult;
    }

    const version = await fetchLatestAppVersion(appInfo);
    const nextResult = toCheckResult(appInfo, version);
    if (manual || shouldShowAutomaticPrompt(nextResult)) {
      setResult(nextResult);
    }
    return nextResult;
  }, []);

  const runManualCheck = useCallback(async () => {
    setChecking(true);
    try {
      return await checkForUpdate(true);
    } finally {
      setChecking(false);
    }
  }, [checkForUpdate]);

  const dismissUpdate = useCallback(() => {
    if (result?.version && !result.forceUpdate) {
      window.localStorage.setItem(dismissedUpdateKey, String(result.version.latestVersionCode));
    }
    setResult(null);
  }, [result]);

  const installUpdate = useCallback(async (target?: AppUpdateCheckResult | unknown) => {
    const targetResult = isAppUpdateCheckResult(target) ? target : result;
    if (!targetResult?.version?.apkUrl) {
      setNotice("\u5f53\u524d\u6ca1\u6709\u53ef\u4e0b\u8f7d\u7684\u5b89\u88c5\u5305\u3002");
      return;
    }

    setDownloading(true);
    setNotice("");
    try {
      await requestNativeApkInstall(toDownloadPayload(targetResult.version));
      setNotice("\u5df2\u5f00\u59cb\u4e0b\u8f7d\uff0c\u4e0b\u8f7d\u5b8c\u6210\u540e\u8bf7\u6309\u7cfb\u7edf\u63d0\u793a\u5b89\u88c5\u3002");
      if (!targetResult.forceUpdate) {
        window.localStorage.setItem(dismissedUpdateKey, String(targetResult.version.latestVersionCode));
      }
    } catch (error) {
      console.warn("Failed to start app update download.", error);
      setNotice("\u4e0b\u8f7d\u542f\u52a8\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u6216\u8054\u7cfb\u7ba1\u7406\u5458\u3002");
    } finally {
      setDownloading(false);
    }
  }, [result]);

  useEffect(() => {
    if (!shouldAutoCheck) return;
    if (window.sessionStorage.getItem(autoCheckedKey) === "1") return;
    window.sessionStorage.setItem(autoCheckedKey, "1");
    checkForUpdate(false).catch((error) => console.warn("Failed to check app update.", error));
  }, [checkForUpdate, shouldAutoCheck]);

  return {
    result,
    checking,
    downloading,
    notice,
    checkForUpdate: runManualCheck,
    dismissUpdate,
    installUpdate,
    clearUpdateResult: () => setResult(null),
  };
}

function toCheckResult(appInfo: NativeAppInfo, version: AppVersionInfo): AppUpdateCheckResult {
  return {
    appInfo,
    version,
    updateAvailable: version.latestVersionCode > 0 && version.updateAvailable,
    forceUpdate: version.forceUpdate,
    canInstallFromApp: appInfo.hasNativeBridge,
  };
}

function shouldShowAutomaticPrompt(result: AppUpdateCheckResult) {
  if (!result.updateAvailable || !result.version) return false;
  if (result.forceUpdate) return true;
  return window.localStorage.getItem(dismissedUpdateKey) !== String(result.version.latestVersionCode);
}

function isAppUpdateCheckResult(value: unknown): value is AppUpdateCheckResult {
  return Boolean(
    value &&
    typeof value === "object" &&
    "version" in value &&
    "appInfo" in value
  );
}

function toDownloadPayload(version: AppVersionInfo): AppUpdateDownloadPayload {
  return {
    apkUrl: version.apkUrl,
    apkSha256: version.apkSha256,
    versionCode: version.latestVersionCode,
    versionName: version.latestVersionName,
    releaseNotes: version.releaseNotes,
  };
}
