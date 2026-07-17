import { apiClient } from "@/services/apiClient";
import type { ChatMember } from "@/types/chat";
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
  avatarUrl?: string;
  updatedAt: string;
  unreadByUserId: Record<string, number>;
  online?: boolean;
  group?: boolean;
  avatarText?: string;
  memberCount?: number;
  description?: string;
  category?: string;
  location?: string;
  joinQuestion?: string;
  isPublic?: boolean;
  ownerUserId?: string;
  joined?: boolean;
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
  type: "text" | "system" | "meal-card-exchange" | "image" | "video" | "audio";
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

interface GroupsResponse {
  groups: BackendConversation[];
}

interface MembersResponse {
  members: ChatMember[];
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

export async function createGroupConversation(input: {
  title: string;
  description: string;
  category?: string;
  location?: string;
  joinQuestion?: string;
  isPublic: boolean;
  memberUserIds?: string[];
}) {
  const response = await apiClient.post<ApiEnvelope<ConversationResponse> | ConversationResponse>("/chat/groups", input);
  return unwrapData(response).conversation;
}

export async function fetchPublicGroups(query = "", category = "") {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (category.trim()) params.set("category", category.trim());
  const response = await apiClient.get<ApiEnvelope<GroupsResponse> | GroupsResponse>(`/chat/groups?${params.toString()}`);
  return unwrapData(response).groups;
}

export async function joinPublicGroup(conversationId: string) {
  const response = await apiClient.post<ApiEnvelope<ConversationResponse> | ConversationResponse>(`/chat/groups/${conversationId}/join`);
  return unwrapData(response).conversation;
}

export async function leaveGroupConversation(conversationId: string) {
  await apiClient.post(`/chat/groups/${conversationId}/leave`);
  return conversationId;
}

export async function updateGroupConversation(conversationId: string, input: {
  title?: string;
  avatarText?: string;
  avatarUrl?: string;
  description?: string;
}) {
  const response = await apiClient.patch<ApiEnvelope<ConversationResponse> | ConversationResponse>(`/chat/groups/${conversationId}`, input);
  return unwrapData(response).conversation;
}

export async function fetchConversationMembers(conversationId: string) {
  const response = await apiClient.get<ApiEnvelope<MembersResponse> | MembersResponse>(`/chat/conversations/${conversationId}/members`);
  return unwrapData(response).members;
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

export async function sendCallSignal(input: {
  conversationId: string;
  callId: string;
  action: "offer" | "answer" | "ice" | "hangup" | "reject";
  payload?: Record<string, unknown>;
}) {
  await apiClient.post(`/chat/conversations/${input.conversationId}/call-signal`, {
    callId: input.callId,
    action: input.action,
    payload: input.payload ?? {},
  });
}

export async function revokeChatMessage(messageId: string) {
  const response = await apiClient.post<ApiEnvelope<MessageResponse> | MessageResponse>(`/chat/messages/${messageId}/revoke`);
  return unwrapData(response).message;
}

export async function deleteChatMessages(conversationId: string, messageIds: string[]) {
  const response = await apiClient.delete<ApiEnvelope<MessagesResponse> | MessagesResponse>(
    `/chat/conversations/${conversationId}/messages`,
    { body: { messageIds } }
  );
  return unwrapData(response).messages;
}

export async function clearConversationMessages(conversationId: string) {
  const response = await apiClient.delete<ApiEnvelope<MessagesResponse> | MessagesResponse>(
    `/chat/conversations/${conversationId}/messages/all`
  );
  return unwrapData(response).messages;
}

export async function updateExchangeRequestStatus(requestId: string, status: "accepted" | "rejected") {
  const response = await apiClient.patch<ApiEnvelope<ExchangeResponse> | ExchangeResponse>(
    `/chat/exchange-requests/${requestId}`,
    { status }
  );
  return unwrapData(response).request;
}
