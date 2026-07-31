import { apiClient } from "@/services/apiClient";
import type { AppNotification } from "@/types/notification";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface NotificationsResponse {
  notifications: AppNotification[];
}

interface NotificationResponse {
  notification: AppNotification;
}

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (response && typeof response === "object" && "success" in response && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }
  return response as T;
}

export async function fetchNotifications() {
  const response = await apiClient.get<ApiEnvelope<NotificationsResponse> | NotificationsResponse>("/notifications");
  return unwrapData(response).notifications;
}

export async function markNotificationRead(notificationId: string) {
  const response = await apiClient.patch<ApiEnvelope<NotificationResponse> | NotificationResponse>(
    `/notifications/${notificationId}/read`
  );
  return unwrapData(response).notification;
}

export async function markNotificationsRead(notificationIds: string[]) {
  return Promise.all(notificationIds.map((id) => markNotificationRead(id).catch(() => null)));
}
