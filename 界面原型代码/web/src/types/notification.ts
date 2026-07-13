/**
 * 正式通知模型草案。
 *
 * 当前原型的通知列表仍由 posts/comments/followedUsers 本地拼装。
 * 后续接后端时应使用这个方向的独立 notification 数据，而不是在 UI 组件里推导通知。
 */
export type NotificationType = "like" | "favorite" | "follow" | "comment" | "mention";

export type AppNotification = {
  id: string;
  type: NotificationType;
  actorUserId: string;
  actorName: string;
  actorAvatar: string;
  targetType: "post" | "comment" | "user";
  targetId: string;
  targetTitle?: string;
  createdAt: string;
  readAt?: string;
};
