import { Router } from "express";
import { sendFailure, sendSuccess } from "../common/http.js";
import { getCurrentUserId } from "../common/request.js";
import { postgresStore } from "../data/postgres.js";

export const notificationsRouter = Router();

notificationsRouter.get("/notifications", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const notifications = await postgresStore.listNotifications(currentUserId);
  sendSuccess(res, { notifications });
});

notificationsRouter.patch("/notifications/read-all", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const notifications = await postgresStore.markAllNotificationsRead(currentUserId);
  sendSuccess(res, { notifications });
});

notificationsRouter.patch("/notifications/:notificationId/read", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const notification = await postgresStore.markNotificationRead(req.params.notificationId, currentUserId);

  if (!notification) {
    sendFailure(res, 404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
    return;
  }

  sendSuccess(res, { notification });
});
