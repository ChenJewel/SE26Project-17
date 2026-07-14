export interface Conversation {
  id: string;
  otherUserId?: string;
  name: string;
  avatar: string;
  preview: string;
  time: string;
  unread: number;
  online?: boolean;
  verified?: boolean;
  group?: boolean;
}

export type ChatMessageType = "text" | "system" | "meal-card-exchange" | "image" | "audio";

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
