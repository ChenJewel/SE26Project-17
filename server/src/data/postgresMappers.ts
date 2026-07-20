import type {
  AiSuggestionCache,
  AiEmbeddingJob,
  AiEmbeddingJobStatus,
  AiEmbeddingJobTargetType,
  AiSuggestionJob,
  AiSuggestionMode,
  AiSuggestionStatus,
  AiMemoryItem,
  AiMemorySourceType,
  AiRecommendationLog,
  CommunityComment,
  CommunityPost,
  Conversation,
  MealCard,
  MealCardRecommendationCache,
  MealCardRecommendationEvent,
  MealCardRecommendationEventType,
  MealCardRecommendationFeature,
  MealExchangeRequest,
  Message,
  MessageType,
  Notification,
  Report,
  User,
  UserPetState,
  UserAiProfile,
  UserSettings,
} from "../types.js";
export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  nickname: string;
  avatar_text: string;
  avatar_url: string | null;
  verified: boolean;
  school: string | null;
  bio: string | null;
  preference_tags: unknown;
  profile_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface MealCardRow {
  id: string;
  user_id: string;
  nickname: string;
  avatar_text: string;
  verified: boolean;
  text: string;
  time: string;
  place: string;
  people: string;
  tags: unknown;
  match_score: number;
  reason: string;
  media_type: "photo" | "video" | null;
  media_url: string | null;
  media_mime_type: string | null;
  status: "active" | "closed" | "deleted";
  edit_count: number;
  created_at: string;
  updated_at: string;
  user_nickname?: string;
  user_avatar_text?: string;
  user_avatar_url?: string | null;
  user_verified?: boolean;
}

export interface CommunityPostRow {
  id: string;
  author_id: string;
  title: string;
  text: string;
  author: string;
  avatar: string;
  channel: string;
  topic: string;
  media_type: "text" | "photo" | "video";
  media_source: "text" | "album" | "camera";
  media_url: string | null;
  media_urls: unknown;
  media_mime_type: string | null;
  place: string;
  likes: number;
  favorites: number;
  comments: number;
  shares: number;
  verified: boolean;
  hot: boolean;
  followed: boolean;
  nearby: boolean;
  status: "published" | "deleted";
  edit_count: number;
  created_at: string;
  updated_at: string;
  user_nickname?: string;
  user_avatar_text?: string;
  user_avatar_url?: string | null;
  user_verified?: boolean;
}

export interface CommunityCommentRow {
  id: string;
  post_id: string;
  author_id: string;
  author: string;
  avatar: string;
  text: string;
  parent_comment_id: string | null;
  reply_to_user_id: string | null;
  reply_to_author: string | null;
  likes: number;
  favorites: number;
  status: "published" | "deleted";
  created_at: string;
  updated_at: string;
  user_nickname?: string;
  user_avatar_text?: string;
  user_avatar_url?: string | null;
}

export interface ReportRow {
  id: string;
  reporter_user_id: string;
  target_type: "post" | "comment" | "meal-card" | "user";
  target_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: "follow" | "comment" | "like" | "favorite" | "report" | "message";
  actor_user_id: string | null;
  target_type: "post" | "comment" | "meal-card" | "conversation" | "user" | null;
  target_id: string | null;
  text: string;
  created_at: string;
  read_at: string | null;
}

export interface ConversationRow {
  id: string;
  title: string;
  preview: string;
  conversation_type: "direct" | "group";
  avatar_text: string | null;
  avatar_url: string | null;
  description: string | null;
  category: string | null;
  location: string | null;
  join_question: string | null;
  is_public: boolean;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMemberRow {
  conversation_id: string;
  user_id: string;
  unread_count: number;
  joined_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  type: MessageType;
  text: string;
  metadata: unknown;
  created_at: string;
  revoked_at: string | null;
}

export interface ExchangeRequestRow {
  id: string;
  sender_user_id: string;
  receiver_user_id: string;
  target_card_id: string;
  own_card_id: string | null;
  conversation_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
}

export interface UserSettingsRow {
  user_id: string;
  settings: unknown;
  updated_at: string;
}

export interface UserPetStateRow {
  user_id: string;
  state: unknown;
  updated_at: string;
}

export interface AiSuggestionJobRow {
  id: string;
  conversation_id: string;
  requester_user_id: string;
  target_user_id: string | null;
  mode: string;
  status: string;
  provider: string;
  input_json: unknown;
  result_json: unknown;
  fallback_json: unknown;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface AiSuggestionCacheRow {
  cache_key: string;
  mode: string;
  provider: string;
  context_hash: string;
  suggestions_json: unknown;
  expires_at: string;
  created_at: string;
}

export interface AiMemoryItemRow {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  text: string;
  canonical_tags: unknown;
  embedding_json: unknown;
  embedding_model: string | null;
  embedded_at: string | null;
  metadata: unknown;
  visibility: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AiEmbeddingJobRow {
  id: string;
  target_type: string;
  target_id: string;
  text_hash: string;
  embedding_model: string;
  status: string;
  priority: number;
  retry_count: number;
  run_after: string | null;
  locked_at: string | null;
  locked_by: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export interface MealCardRecommendationFeatureRow {
  card_id: string;
  feature_json: unknown;
  text_hash: string;
  model_version: string;
  embedding_model: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MealCardRecommendationCacheRow {
  user_id: string;
  card_id: string;
  semantic_score: number;
  reason_tags: string[] | string;
  feature_version: string;
  source_hash: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MealCardRecommendationEventRow {
  id: string;
  user_id: string;
  card_id: string | null;
  author_user_id: string | null;
  event_type: string;
  rank: number | null;
  match_score: number | null;
  reason: string | null;
  source: string;
  context_json: unknown;
  created_at: string;
}

export interface UserAiProfileRow {
  user_id: string;
  profile_json: unknown;
  updated_at: string;
}

export interface AiRecommendationLogRow {
  id: string;
  conversation_id: string;
  requester_user_id: string;
  target_user_id: string | null;
  job_id: string | null;
  mode: string;
  provider: string;
  context_json: unknown;
  suggestions_json: unknown;
  selected_index: number | null;
  selected_text: string | null;
  sent_message_id: string | null;
  recipient_replied_at: string | null;
  advanced_to_meal_at: string | null;
  outcome_json: unknown;
  created_at: string;
  updated_at: string;
}

export function mapOptional<Row, Entity>(row: Row | undefined, mapper: (row: Row) => Entity) {
  return row ? mapper(row) : undefined;
}

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role === "admin" ? "admin" : "user",
    nickname: row.nickname,
    avatarText: row.avatar_text,
    avatarUrl: row.avatar_url ?? undefined,
    verified: row.verified,
    school: row.school ?? undefined,
    bio: row.bio ?? undefined,
    preferenceTags: parseStringArray(row.preference_tags),
    profileCompleted: row.profile_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMealCard(row: MealCardRow): MealCard {
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.user_nickname ?? row.nickname,
    avatarText: row.user_avatar_text ?? row.avatar_text,
    avatarUrl: row.user_avatar_url ?? undefined,
    verified: row.user_verified ?? row.verified,
    text: row.text,
    time: row.time,
    place: row.place,
    people: row.people,
    tags: parseStringArray(row.tags),
    matchScore: row.match_score,
    reason: row.reason,
    mediaType: row.media_type ?? undefined,
    mediaUrl: row.media_url ?? undefined,
    mediaMimeType: row.media_mime_type ?? undefined,
    status: row.status,
    editCount: row.edit_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCommunityPost(row: CommunityPostRow): CommunityPost {
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    text: row.text,
    author: row.user_nickname ?? row.author,
    avatar: row.user_avatar_text ?? row.avatar,
    avatarUrl: row.user_avatar_url ?? undefined,
    channel: row.channel,
    topic: row.topic,
    mediaType: row.media_type,
    mediaSource: row.media_source,
    mediaUrl: row.media_url ?? undefined,
    mediaUrls: parseStringArray(row.media_urls),
    mediaMimeType: row.media_mime_type ?? undefined,
    place: row.place,
    likes: row.likes,
    favorites: row.favorites,
    comments: row.comments,
    shares: row.shares,
    verified: row.user_verified ?? row.verified,
    hot: row.hot,
    followed: row.followed,
    nearby: row.nearby,
    status: row.status,
    editCount: row.edit_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCommunityComment(row: CommunityCommentRow): CommunityComment {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    author: row.user_nickname ?? row.author,
    avatar: row.user_avatar_text ?? row.avatar,
    avatarUrl: row.user_avatar_url ?? undefined,
    text: row.text,
    parentCommentId: row.parent_comment_id ?? undefined,
    replyToUserId: row.reply_to_user_id ?? undefined,
    replyToAuthor: row.reply_to_author ?? undefined,
    likes: row.likes,
    favorites: row.favorites,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapReport(row: ReportRow): Report {
  return {
    id: row.id,
    reporterUserId: row.reporter_user_id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    actorUserId: row.actor_user_id ?? undefined,
    targetType: row.target_type ?? undefined,
    targetId: row.target_id ?? undefined,
    text: row.text,
    createdAt: row.created_at,
    readAt: row.read_at ?? undefined,
  };
}

export function mapConversation(row: ConversationRow, members: ConversationMemberRow[]): Conversation {
  return {
    id: row.id,
    memberUserIds: members.map((member) => member.user_id),
    title: row.title,
    preview: row.preview,
    conversationType: row.conversation_type === "group" ? "group" : "direct",
    avatarText: row.avatar_text ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    location: row.location ?? undefined,
    joinQuestion: row.join_question ?? undefined,
    isPublic: row.is_public,
    ownerUserId: row.owner_user_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    unreadByUserId: Object.fromEntries(members.map((member) => [member.user_id, member.unread_count])),
  };
}

export function mapMessage(row: MessageRow, readByUserIds: string[]): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id,
    type: row.type,
    text: row.text,
    metadata: parseRecord(row.metadata),
    createdAt: row.created_at,
    readByUserIds,
    ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}),
  };
}

export function mapExchangeRequest(row: ExchangeRequestRow): MealExchangeRequest {
  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    receiverUserId: row.receiver_user_id,
    targetCardId: row.target_card_id,
    ownCardId: row.own_card_id ?? undefined,
    conversationId: row.conversation_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapUserSettings(row: UserSettingsRow): UserSettings {
  return {
    userId: row.user_id,
    settings: parseRecord(row.settings),
    updatedAt: row.updated_at,
  };
}

export function mapUserPetState(row: UserPetStateRow): UserPetState {
  return {
    userId: row.user_id,
    state: parseRecord(row.state),
    updatedAt: row.updated_at,
  };
}

export function mapAiSuggestionJob(row: AiSuggestionJobRow): AiSuggestionJob {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    requesterUserId: row.requester_user_id,
    targetUserId: row.target_user_id ?? undefined,
    mode: parseAiSuggestionMode(row.mode),
    status: parseAiSuggestionStatus(row.status),
    provider: row.provider,
    input: parseRecord(row.input_json),
    result: parseRecord(row.result_json),
    fallbackSuggestions: parseStringArray(row.fallback_json),
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
  };
}

export function mapAiSuggestionCache(row: AiSuggestionCacheRow): AiSuggestionCache {
  return {
    cacheKey: row.cache_key,
    mode: parseAiSuggestionMode(row.mode),
    provider: row.provider,
    contextHash: row.context_hash,
    suggestions: parseStringArray(row.suggestions_json),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function mapAiMemoryItem(row: AiMemoryItemRow): AiMemoryItem {
  return {
    id: row.id,
    userId: row.user_id,
    sourceType: parseAiMemorySourceType(row.source_type),
    sourceId: row.source_id,
    text: row.text,
    canonicalTags: parseStringArray(row.canonical_tags),
    embedding: parseNumberArray(row.embedding_json),
    embeddingModel: row.embedding_model ?? undefined,
    embeddedAt: row.embedded_at ?? undefined,
    metadata: parseRecord(row.metadata),
    visibility: "public",
    status: row.status === "deleted" ? "deleted" : "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAiEmbeddingJob(row: AiEmbeddingJobRow): AiEmbeddingJob {
  return {
    id: row.id,
    targetType: parseAiEmbeddingJobTargetType(row.target_type),
    targetId: row.target_id,
    textHash: row.text_hash,
    embeddingModel: row.embedding_model,
    status: parseAiEmbeddingJobStatus(row.status),
    priority: row.priority,
    retryCount: row.retry_count,
    runAfter: row.run_after ?? undefined,
    lockedAt: row.locked_at ?? undefined,
    lockedBy: row.locked_by ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at ?? undefined,
  };
}

export function mapMealCardRecommendationFeature(row: MealCardRecommendationFeatureRow): MealCardRecommendationFeature {
  return {
    cardId: row.card_id,
    feature: toRecord(row.feature_json),
    textHash: row.text_hash,
    modelVersion: row.model_version,
    embeddingModel: row.embedding_model ?? undefined,
    status: parseMealCardRecommendationFeatureStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMealCardRecommendationCache(row: MealCardRecommendationCacheRow): MealCardRecommendationCache {
  return {
    userId: row.user_id,
    cardId: row.card_id,
    semanticScore: Number(row.semantic_score) || 0,
    reasonTags: parseStringArray(row.reason_tags),
    featureVersion: row.feature_version,
    sourceHash: row.source_hash,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMealCardRecommendationEvent(row: MealCardRecommendationEventRow): MealCardRecommendationEvent {
  return {
    id: row.id,
    userId: row.user_id,
    cardId: row.card_id ?? undefined,
    authorUserId: row.author_user_id ?? undefined,
    eventType: parseMealCardRecommendationEventType(row.event_type),
    rank: row.rank ?? undefined,
    matchScore: row.match_score ?? undefined,
    reason: row.reason ?? undefined,
    source: row.source,
    context: parseRecord(row.context_json),
    createdAt: row.created_at,
  };
}

export function mapUserAiProfile(row: UserAiProfileRow): UserAiProfile {
  return {
    userId: row.user_id,
    profile: parseRecord(row.profile_json),
    updatedAt: row.updated_at,
  };
}

export function mapAiRecommendationLog(row: AiRecommendationLogRow): AiRecommendationLog {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    requesterUserId: row.requester_user_id,
    targetUserId: row.target_user_id ?? undefined,
    jobId: row.job_id ?? undefined,
    mode: parseAiSuggestionMode(row.mode),
    provider: row.provider,
    context: parseRecord(row.context_json),
    suggestions: parseStringArray(row.suggestions_json),
    selectedIndex: row.selected_index ?? undefined,
    selectedText: row.selected_text ?? undefined,
    sentMessageId: row.sent_message_id ?? undefined,
    recipientRepliedAt: row.recipient_replied_at ?? undefined,
    advancedToMealAt: row.advanced_to_meal_at ?? undefined,
    outcome: parseRecord(row.outcome_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function parseAiSuggestionMode(value: string): AiSuggestionMode {
  return value === "opener" || value === "advance" ? value : "reply";
}

export function parseAiSuggestionStatus(value: string): AiSuggestionStatus {
  return value === "running" || value === "succeeded" || value === "failed" ? value : "pending";
}

export function parseAiMemorySourceType(value: string): AiMemorySourceType {
  if (value === "meal_card" || value === "post" || value === "comment") return value;
  return "profile_tag";
}

export function parseAiEmbeddingJobTargetType(value: string): AiEmbeddingJobTargetType {
  if (value === "meal_card" || value === "semantic_mapping") return value;
  return "ai_memory_item";
}

export function parseAiEmbeddingJobStatus(value: string): AiEmbeddingJobStatus {
  if (value === "running" || value === "succeeded" || value === "failed") return value;
  return "pending";
}

export function parseMealCardRecommendationFeatureStatus(value: string): MealCardRecommendationFeature["status"] {
  if (value === "stale" || value === "deleted") return value;
  return "active";
}

export function parseMealCardRecommendationEventType(value: string): MealCardRecommendationEventType {
  if (
    value === "detail_open" ||
    value === "invite" ||
    value === "accept" ||
    value === "reject" ||
    value === "block" ||
    value === "report" ||
    value === "skip"
  ) {
    return value;
  }
  return "exposure";
}

export function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function parseStringArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function parseNumberArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : [];
  } catch {
    return [];
  }
}

export function parseRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
