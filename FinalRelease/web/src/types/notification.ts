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
  actor?: {
    id: string;
    nickname: string;
    avatarText: string;
    avatarUrl?: string;
    verified?: boolean;
  };
  targetPost?: {
    id: string;
    title: string;
    text: string;
    mediaType: "text" | "photo" | "video";
    mediaUrl?: string;
    mediaUrls?: string[];
    mediaPosterUrl?: string;
  };
  targetComment?: {
    id: string;
    postId: string;
    authorId?: string;
    author: string;
    avatar: string;
    avatarUrl?: string;
    text: string;
    parentCommentId?: string;
    replyToUserId?: string;
    replyToAuthor?: string;
  };
  parentComment?: {
    id: string;
    postId: string;
    authorId?: string;
    author: string;
    avatar: string;
    avatarUrl?: string;
    text: string;
  };
};
