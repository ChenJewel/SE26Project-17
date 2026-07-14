export type NotificationType = "like" | "favorite" | "follow" | "comment" | "message" | "report";

export type AppNotification = {
  id: string;
  type: NotificationType;
  userId: string;
  actorUserId?: string;
  targetType?: "post" | "comment" | "meal-card" | "conversation" | "user";
  targetId?: string;
  text: string;
  createdAt: string;
  readAt?: string;
};
