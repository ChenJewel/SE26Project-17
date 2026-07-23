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
  profileCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PublicUser = Omit<User, "passwordHash">;

export interface MealCard {
  id: string;
  userId: string;
  nickname: string;
  avatarText: string;
  avatarUrl?: string;
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
  editCount: number;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  title: string;
  text: string;
  author: string;
  avatar: string;
  avatarUrl?: string;
  channel: string;
  topic: string;
  mediaType: "text" | "photo" | "video";
  mediaSource: "text" | "album" | "camera";
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaPosterUrl?: string;
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
  editCount: number;
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  author: string;
  avatar: string;
  avatarUrl?: string;
  text: string;
  parentCommentId?: string;
  replyToUserId?: string;
  replyToAuthor?: string;
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
  conversationType?: "direct" | "group";
  avatarText?: string;
  avatarUrl?: string;
  description?: string;
  category?: string;
  location?: string;
  joinQuestion?: string;
  isPublic?: boolean;
  ownerUserId?: string;
  createdAt?: string;
  updatedAt: string;
  unreadByUserId: Record<string, number>;
}

export type MessageType = "text" | "system" | "meal-card-exchange" | "image" | "video" | "audio";

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
  actor?: {
    id: string;
    nickname: string;
    avatarText: string;
    avatarUrl?: string;
    verified?: boolean;
  };
  targetPost?: CommunityPost;
  targetComment?: CommunityComment;
  parentComment?: CommunityComment;
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

export interface UserSettings {
  userId: string;
  settings: Record<string, unknown>;
  updatedAt: string;
}

export interface UserPetState {
  userId: string;
  state: Record<string, unknown>;
  updatedAt: string;
}

export type AiSuggestionMode = "opener" | "reply" | "advance";
export type AiSuggestionStatus = "pending" | "running" | "succeeded" | "failed";

export interface AiSuggestionJob {
  id: string;
  conversationId: string;
  requesterUserId: string;
  targetUserId?: string;
  mode: AiSuggestionMode;
  status: AiSuggestionStatus;
  provider: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  fallbackSuggestions: string[];
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface AiSuggestionCache {
  cacheKey: string;
  mode: AiSuggestionMode;
  provider: string;
  contextHash: string;
  suggestions: string[];
  expiresAt: string;
  createdAt: string;
}

export type AiMemorySourceType = "profile_tag" | "meal_card" | "post" | "comment";

export interface AiMemoryItem {
  id: string;
  userId: string;
  sourceType: AiMemorySourceType;
  sourceId: string;
  text: string;
  canonicalTags: string[];
  embedding: number[];
  embeddingModel?: string;
  embeddedAt?: string;
  metadata: Record<string, unknown>;
  visibility: "public";
  status: "active" | "deleted";
  createdAt: string;
  updatedAt: string;
}

export type AiEmbeddingJobTargetType = "ai_memory_item" | "meal_card" | "semantic_mapping";
export type AiEmbeddingJobStatus = "pending" | "running" | "succeeded" | "failed";

export interface AiEmbeddingJob {
  id: string;
  targetType: AiEmbeddingJobTargetType;
  targetId: string;
  textHash: string;
  embeddingModel: string;
  status: AiEmbeddingJobStatus;
  priority: number;
  retryCount: number;
  runAfter?: string;
  lockedAt?: string;
  lockedBy?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export interface MealCardRecommendationFeature {
  cardId: string;
  feature: Record<string, unknown>;
  textHash: string;
  modelVersion: string;
  embeddingModel?: string;
  status: "active" | "stale" | "deleted";
  createdAt: string;
  updatedAt: string;
}

export interface MealCardRecommendationCache {
  userId: string;
  cardId: string;
  semanticScore: number;
  reasonTags: string[];
  featureVersion: string;
  sourceHash: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type MealCardRecommendationEventType =
  | "exposure"
  | "detail_open"
  | "invite"
  | "accept"
  | "reject"
  | "block"
  | "report"
  | "skip";

export interface MealCardRecommendationEvent {
  id: string;
  userId: string;
  cardId?: string;
  authorUserId?: string;
  eventType: MealCardRecommendationEventType;
  rank?: number;
  matchScore?: number;
  reason?: string;
  source: string;
  context: Record<string, unknown>;
  createdAt: string;
}

export interface UserAiProfile {
  userId: string;
  profile: Record<string, unknown>;
  updatedAt: string;
}

export interface AiRecommendationLog {
  id: string;
  conversationId: string;
  requesterUserId: string;
  targetUserId?: string;
  jobId?: string;
  mode: AiSuggestionMode;
  provider: string;
  context: Record<string, unknown>;
  suggestions: string[];
  selectedIndex?: number;
  selectedText?: string;
  sentMessageId?: string;
  recipientRepliedAt?: string;
  advancedToMealAt?: string;
  outcome?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
