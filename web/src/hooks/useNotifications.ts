import { useEffect, useMemo, useState } from "react";
import { fetchNotifications, markNotificationsRead } from "@/services/notificationsApi";
import { subscribeRealtimeEvents } from "@/hooks/useRealtimeEvents";
import type { AppNotification, NotificationType } from "@/types/notification";

export function useNotifications(isAuthenticated: boolean) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    fetchNotifications()
      .then((items) => {
        if (!cancelled) setNotifications(items);
      })
      .catch((error) => {
        console.warn("Failed to load notifications.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeRealtimeEvents((event) => {
      if (event.type === "notification.created" || event.type.startsWith("chat.")) {
        fetchNotifications()
          .then(setNotifications)
          .catch((error) => {
            console.warn("Failed to refresh notifications.", error);
          });
      }
    });
  }, [isAuthenticated]);

  const unreadCounts = useMemo(() => {
    return notifications.reduce<Record<NotificationType, number>>(
      (counts, notification) => {
        if (!notification.readAt) counts[notification.type] += 1;
        return counts;
      },
      { like: 0, favorite: 0, follow: 0, comment: 0, message: 0, report: 0 }
    );
  }, [notifications]);

  const markTypeRead = async (types: NotificationType[]) => {
    const ids = notifications
      .filter((notification) => !notification.readAt && types.includes(notification.type))
      .map((notification) => notification.id);

    if (!ids.length) return;

    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) => (ids.includes(notification.id) ? { ...notification, readAt } : notification))
    );
    const updated = await markNotificationsRead(ids);
    setNotifications((current) =>
      current.map((notification) => updated.find((item) => item?.id === notification.id) ?? notification)
    );
  };

  return {
    notifications,
    unreadCounts,
    markTypeRead,
  };
}
