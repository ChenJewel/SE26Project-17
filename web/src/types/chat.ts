export interface Conversation {
  id: string;
  otherUserId?: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  preview: string;
  time: string;
  updatedAt?: string;
  unread: number;
  online?: boolean;
  verified?: boolean;
  group?: boolean;
  memberCount?: number;
  description?: string;
  category?: string;
  location?: string;
  joinQuestion?: string;
  isPublic?: boolean;
  ownerUserId?: string;
  joined?: boolean;
  blocked?: boolean;
  blockedBy?: boolean;
  blockedEither?: boolean;
}

export type ChatMessageType = "text" | "system" | "meal-card-exchange" | "image" | "video" | "audio";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  type: ChatMessageType;
  text: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readByUserIds: string[];
  revokedAt?: string;
}

export interface ChatMember {
  id: string;
  nickname: string;
  avatarText: string;
  avatarUrl?: string;
  verified: boolean;
  school?: string;
  role?: "owner" | "member";
  online?: boolean;
}
