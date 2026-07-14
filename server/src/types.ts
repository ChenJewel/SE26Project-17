export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: "user" | "admin";
  nickname: string;
  avatarText: string;
  avatarUrl?: string;
  verified: boolean;
  school?: string;
  bio?: string;
  preferenceTags: string[];
  createdAt: string;
  updatedAt: string;
}

export type PublicUser = Omit<User, "passwordHash">;

export interface MealCard {
  id: string;
  userId: string;
  nickname: string;
  avatarText: string;
  verified: boolean;
  text: string;
  time: string;
  place: string;
  people: string;
  tags: string[];
  matchScore: number;
  reason: string;
  mediaType?: "photo" | "video";
  mediaUrl?: string;
  mediaMimeType?: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "closed" | "deleted";
}

export interface CommunityPost {
  id: string;
  authorId: string;
  title: string;
  text: string;
  author: string;
  avatar: string;
  channel: string;
  topic: string;
  mediaType: "text" | "photo" | "video";
  mediaSource: "text" | "album" | "camera";
  mediaUrl?: string;
  mediaMimeType?: string;
  place: string;
  likes: number;
  favorites: number;
  comments: number;
  shares: number;
  verified?: boolean;
  hot?: boolean;
  followed?: boolean;
  nearby?: boolean;
  createdAt: string;
  updatedAt: string;
  status: "published" | "deleted";
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  author: string;
  avatar: string;
  text: string;
  likes: number;
  favorites?: number;
  createdAt: string;
  updatedAt: string;
  status: "published" | "deleted";
}

export interface Report {
  id: string;
  reporterUserId: string;
  targetType: "post" | "comment" | "meal-card" | "user";
  targetId: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  memberUserIds: string[];
  title: string;
  preview: string;
  updatedAt: string;
  unreadByUserId: Record<string, number>;
}

export type MessageType = "text" | "system" | "meal-card-exchange" | "image" | "audio";

export interface Message {
  id: string;
  conversationId: string;
  senderUserId: string;
  type: MessageType;
  text: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readByUserIds: string[];
  revokedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: "follow" | "comment" | "like" | "favorite" | "report" | "message";
  actorUserId?: string;
  targetType?: "post" | "comment" | "meal-card" | "conversation" | "user";
  targetId?: string;
  text: string;
  createdAt: string;
  readAt?: string;
}

export interface MealExchangeRequest {
  id: string;
  senderUserId: string;
  receiverUserId: string;
  targetCardId: string;
  ownCardId?: string;
  conversationId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  updatedAt: string;
}
