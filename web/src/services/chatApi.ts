import { apiClient } from "@/services/apiClient";
import type { MealCard } from "@/types/meal";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface BackendConversation {
  id: string;
  memberUserIds: string[];
  otherUserId?: string;
  title: string;
  preview: string;
  updatedAt: string;
  unreadByUserId: Record<string, number>;
  online?: boolean;
}

export interface BackendExchangeRequest {
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

export interface BackendMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  type: "text" | "system" | "meal-card-exchange" | "image" | "audio";
  text: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readByUserIds: string[];
  revokedAt?: string;
}

interface ConversationsResponse {
  conversations: BackendConversation[];
}

interface ConversationResponse {
  conversation: BackendConversation;
}

interface InviteResponse {
  request: BackendExchangeRequest;
  conversation: BackendConversation;
}

interface MessagesResponse {
  messages: BackendMessage[];
  exchangeRequests?: BackendExchangeRequest[];
  cards?: MealCard[];
}

interface MessageResponse {
  message: BackendMessage;
}

interface ExchangeResponse {
  request: BackendExchangeRequest;
}

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (response && typeof response === "object" && "success" in response && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }
  return response as T;
}

export async function fetchChatConversations() {
  const response = await apiClient.get<ApiEnvelope<ConversationsResponse> | ConversationsResponse>("/chat/conversations");
  return unwrapData(response).conversations;
}

export async function createDirectConversation(userId: string, title?: string) {
  const response = await apiClient.post<ApiEnvelope<ConversationResponse> | ConversationResponse>("/chat/conversations", {
    memberUserIds: [userId],
    title: title || "私信",
  });
  return unwrapData(response).conversation;
}

export async function createMealInvite(cardId: string) {
  const response = await apiClient.post<ApiEnvelope<InviteResponse> | InviteResponse>(`/meal-cards/${cardId}/invite`);
  return unwrapData(response);
}

export async function fetchConversationMessages(conversationId: string) {
  const response = await apiClient.get<ApiEnvelope<MessagesResponse> | MessagesResponse>(
    `/chat/conversations/${conversationId}/messages`
  );
  return unwrapData(response);
}

export async function markConversationRead(conversationId: string) {
  const response = await apiClient.post<ApiEnvelope<{ conversation: BackendConversation }> | { conversation: BackendConversation }>(
    `/chat/conversations/${conversationId}/read`
  );
  return unwrapData(response).conversation;
}

export async function sendChatMessage(input: {
  conversationId: string;
  text?: string;
  type?: BackendMessage["type"];
  metadata?: Record<string, unknown>;
}) {
  const response = await apiClient.post<ApiEnvelope<MessageResponse> | MessageResponse>("/chat/messages", input);
  return unwrapData(response).message;
}

export async function sendTypingState(conversationId: string, typing: boolean) {
  await apiClient.post(`/chat/conversations/${conversationId}/typing`, { typing });
}

export async function revokeChatMessage(messageId: string) {
  const response = await apiClient.post<ApiEnvelope<MessageResponse> | MessageResponse>(`/chat/messages/${messageId}/revoke`);
  return unwrapData(response).message;
}

export async function updateExchangeRequestStatus(requestId: string, status: "accepted" | "rejected") {
  const response = await apiClient.patch<ApiEnvelope<ExchangeResponse> | ExchangeResponse>(
    `/chat/exchange-requests/${requestId}`,
    { status }
  );
  return unwrapData(response).request;
}
