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

  const installUpdate = useCallback(async (target = result) => {
    if (!target?.version?.apkUrl) {
      setNotice("当前没有可下载的安装包。");
      return;
    }

    setDownloading(true);
    setNotice("");
    try {
      await requestNativeApkInstall(toDownloadPayload(target.version));
      setNotice("已开始下载，下载完成后请按系统提示安装。");
      if (!target.forceUpdate) {
        window.localStorage.setItem(dismissedUpdateKey, String(target.version.latestVersionCode));
      }
    } catch (error) {
      console.warn("Failed to start app update download.", error);
      setNotice("下载启动失败，请稍后再试或联系管理员。");
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

function toDownloadPayload(version: AppVersionInfo): AppUpdateDownloadPayload {
  return {
    apkUrl: version.apkUrl,
    apkSha256: version.apkSha256,
    versionCode: version.latestVersionCode,
    versionName: version.latestVersionName,
    releaseNotes: version.releaseNotes,
  };
}
