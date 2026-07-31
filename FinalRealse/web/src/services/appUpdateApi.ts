import { apiClient } from "@/services/apiClient";
import type { AppVersionInfo, NativeAppInfo } from "@/types/appUpdate";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (response && typeof response === "object" && "success" in response && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }
  return response as T;
}

export async function fetchLatestAppVersion(appInfo: NativeAppInfo) {
  const query = new URLSearchParams({
    platform: "android",
    channel: appInfo.channel || "official",
    versionCode: String(appInfo.versionCode || 0),
  });
  const response = await apiClient.get<ApiEnvelope<AppVersionInfo> | AppVersionInfo>(`/app/version/latest?${query.toString()}`);
  return unwrapData(response);
}
