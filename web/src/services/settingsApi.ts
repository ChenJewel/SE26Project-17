import { apiClient } from "@/services/apiClient";
import type { AppSettings, UserSettingsResponse } from "@/types/settings";

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

export async function fetchMySettings() {
  const response = await apiClient.get<ApiEnvelope<UserSettingsResponse> | UserSettingsResponse>("/users/me/settings");
  return unwrapData(response);
}

export async function updateMySettings(settings: AppSettings) {
  const response = await apiClient.patch<ApiEnvelope<UserSettingsResponse> | UserSettingsResponse>("/users/me/settings", settings);
  return unwrapData(response);
}
