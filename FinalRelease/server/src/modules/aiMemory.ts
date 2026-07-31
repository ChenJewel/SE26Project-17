import { createHash } from "node:crypto";
import { postgresStore } from "../data/postgres.js";
import { makeId } from "../data/store.js";
import type { AiMemoryItem, AiMemorySourceType, Conversation, UserAiProfile } from "../types.js";
import {
  buildCanonicalTags as buildSharedCanonicalTags,
  cosineSimilarity as semanticCosineSimilarity,
  extractCanonicalTags as extractSharedCanonicalTags,
  getTagDimension,
  labelForTag as labelForSemanticTag,
} from "./semanticSignals.js";
import {
  createEmbedding,
  createFallbackEmbedding,
  readEmbeddingConfig,
  shouldCreateInlineEmbeddings,
  shouldQueueEmbeddingBackfill,
} from "./embeddingProvider.js";

export interface AiEvidenceSignal {
  tag: string;
  label: string;
  score: number;
  evidence: string[];
  kind?: "shared" | "query" | "complementary" | "target" | "current";
}

export interface AiEvidenceResult {
  signals: AiEvidenceSignal[];
  reason?: string;
  profileSummaries?: AiProfileSummary[];
}

export interface AiProfileSummary {
  userId: string;
  role: "current" | "other";
  topLabels: string[];
  dimensions: Record<string, Array<{ tag: string; label: string; score: number }>>;
  confidence: number;
}

export interface BuildConversationEvidenceOptions {
  allowRealtimeQueryEmbedding?: boolean;
}

interface MemoryDraft {
  sourceType: AiMemorySourceType;
  sourceId: string;
  text: string;
  rawTags?: string[];
  metadata?: Record<string, unknown>;
}

const taxonomy: Array<{ tag: string; label: string; keywords: string[] }> = [
  { tag: "japanese_food", label: "日料/寿司", keywords: ["日料", "寿司", "刺身", "拉面", "居酒屋", "乌冬", "和牛"] },
  { tag: "hotpot", label: "火锅", keywords: ["火锅", "串串", "冒菜", "麻辣烫"] },
  { tag: "spicy_food", label: "重口/辣味", keywords: ["辣", "麻辣", "川菜", "湘菜", "烧烤"] },
  { tag: "light_food", label: "清淡/轻食", keywords: ["清淡", "轻食", "沙拉", "粥", "健康", "素食"] },
  { tag: "dessert_drink", label: "甜品/饮品", keywords: ["奶茶", "咖啡", "甜品", "蛋糕", "冰淇淋", "面包"] },
  { tag: "noodle_rice", label: "面饭主食", keywords: ["面", "粉", "饭", "盖饭", "炒饭", "拌饭", "米线"] },
  { tag: "canteen", label: "食堂/校园", keywords: ["食堂", "校园", "校内", "交大", "闵行", "徐汇"] },
  { tag: "quiet_dining", label: "安静小店", keywords: ["安静", "小店", "聊天", "不吵", "舒服", "氛围"] },
  { tag: "budget_friendly", label: "平价", keywords: ["平价", "便宜", "性价比", "学生党", "实惠"] },
  { tag: "photo_share", label: "拍照分享", keywords: ["拍照", "出片", "好看", "打卡", "照片"] },
  { tag: "gentle_chat", label: "轻松慢聊", keywords: ["慢热", "轻松", "随便聊", "不尴尬", "社恐", "低压力"] },
  { tag: "active_invite", label: "直接约饭", keywords: ["约饭", "一起吃", "饭搭子", "搭子", "今晚", "明天"] },
];

const derivedTaxonomy: Array<{ tag: string; label: string; keywords: string[] }> = [
  { tag: "korean_food", label: "韩餐/烤肉", keywords: ["韩餐", "韩国", "烤肉", "部队锅", "拌饭", "炸鸡"] },
  { tag: "western_food", label: "西餐/简餐", keywords: ["西餐", "披萨", "意面", "牛排", "汉堡", "brunch"] },
  { tag: "seafood", label: "海鲜", keywords: ["海鲜", "鱼生", "虾", "蟹", "贝", "生蚝"] },
  { tag: "late_night", label: "夜宵", keywords: ["夜宵", "宵夜", "晚上", "半夜", "深夜", "下课后"] },
  { tag: "breakfast", label: "早餐", keywords: ["早餐", "早八", "豆浆", "包子", "早饭"] },
  { tag: "low_pressure", label: "低压力相处", keywords: ["随缘", "不尬", "不催", "慢慢", "舒服", "低压力"] },
  { tag: "explore_new_places", label: "探索新店", keywords: ["探店", "新店", "种草", "没去过", "尝试", "打卡"] },
  { tag: "planner", label: "偏好计划", keywords: ["几点", "时间", "预约", "定一下", "安排", "计划"] },
  { tag: "casual_chat", label: "轻松闲聊", keywords: ["闲聊", "随便聊", "哈哈", "有趣", "好玩", "梗"] },
  { tag: "study_work", label: "学习/自习", keywords: ["自习", "图书馆", "作业", "ddl", "实验", "复习"] },
];

const allTaxonomy = [...taxonomy, ...derivedTaxonomy];

const tagDimensions: Record<string, string> = {
  japanese_food: "food",
  hotpot: "food",
  spicy_food: "food",
  light_food: "food",
  dessert_drink: "food",
  noodle_rice: "food",
  korean_food: "food",
  western_food: "food",
  seafood: "food",
  canteen: "scene",
  quiet_dining: "scene",
  budget_friendly: "scene",
  photo_share: "scene",
  late_night: "time",
  breakfast: "time",
  gentle_chat: "social",
  low_pressure: "social",
  casual_chat: "social",
  active_invite: "intent",
  planner: "intent",
  explore_new_places: "intent",
  study_work: "topic",
};

const sourceWeights: Record<AiMemorySourceType, number> = {
  profile_tag: 3,
  meal_card: 2.2,
  post: 1.5,
  comment: 1,
};

const complementaryRules: Array<{ tag: string; withTag: string; label: string; reasonLabel: string }> = [
  { tag: "active_invite", withTag: "quiet_dining", label: "低压力约饭", reasonLabel: "一个想推进约饭，一个偏好安静小店" },
  { tag: "active_invite", withTag: "low_pressure", label: "低压力约饭", reasonLabel: "一个想推进约饭，一个偏好轻松低压力" },
  { tag: "photo_share", withTag: "explore_new_places", label: "探店拍照", reasonLabel: "一个喜欢分享照片，一个对新店有兴趣" },
  { tag: "canteen", withTag: "budget_friendly", label: "校园平价", reasonLabel: "校园场景和平价偏好能接上" },
  { tag: "japanese_food", withTag: "quiet_dining", label: "安静日料", reasonLabel: "日料兴趣和安静小店偏好能接上" },
  { tag: "dessert_drink", withTag: "casual_chat", label: "轻松饮品局", reasonLabel: "饮品甜点适合作为轻松聊天入口" },
];

const profileRefreshMs = readPositiveInteger(process.env.AI_PROFILE_REFRESH_MS, 10 * 60 * 1000);
const profileVersion = "m3-profile-match-v2";
const refreshedAtByUserId = new Map<string, number>();
const pendingEmbeddingItems = new Map<string, AiMemoryItem>();
let embeddingBackfillRunning = false;

export async function buildConversationEvidence(
  conversation: Conversation,
  currentUserId: string,
  queryText = "",
  options: BuildConversationEvidenceOptions = {}
): Promise<AiEvidenceResult> {
  if (process.env.AI_PROFILE_ENABLED === "false" || process.env.AI_RECALL_ENABLED === "false") {
    return { signals: [] };
  }

  const memberUserIds = conversation.memberUserIds.slice(0, 6);
  const profiles = await Promise.all(memberUserIds.map((userId) => refreshUserAiProfile(userId)));
  const memories = await postgresStore.listAiMemoryItemsForUsers(memberUserIds, 180);
  const queryTags = extractCanonicalTags(queryText);
  const signals = uniqueSignals([
    ...rankEvidenceSignals(memories, memberUserIds, currentUserId, queryTags),
    ...(await rankVectorEvidenceSignals(memories, memberUserIds, currentUserId, queryText, options)),
  ]);
  if (!signals.length && queryText.trim()) {
    signals.push({
      tag: "current_topic",
      label: "当前话题",
      score: 0.2,
      evidence: [`当前输入：${clipText(queryText, 36)}`],
      kind: "current",
    });
  }
  return {
    signals: signals.slice(0, 4),
    reason: buildReason(signals),
    profileSummaries: profiles.map((profile) => summarizeProfile(profile, profile.userId === currentUserId ? "current" : "other")),
  };
}

export async function refreshUserAiProfile(userId: string): Promise<UserAiProfile> {
  const lastRefreshAt = refreshedAtByUserId.get(userId) ?? 0;
  const currentProfile = await postgresStore.getUserAiProfile(userId);
  if (
    Date.now() - lastRefreshAt < profileRefreshMs &&
    currentProfile.profile.version === profileVersion &&
    Object.keys(currentProfile.profile).length
  ) {
    return currentProfile;
  }

  const user = await postgresStore.findUserById(userId);
  if (!user) return currentProfile;

  const [mealCards, posts, comments] = await Promise.all([
    postgresStore.listMealCardsByUser(userId),
    postgresStore.listPublishedPostsByUser(userId),
    postgresStore.listCommentsByUser(userId),
  ]);

  const drafts: MemoryDraft[] = [
    ...user.preferenceTags.map((tag) => ({
      sourceType: "profile_tag" as const,
      sourceId: stableSourceId("profile_tag", tag),
      text: tag,
      rawTags: [tag],
      metadata: { source: "preferenceTags" },
    })),
    ...mealCards
      .filter((card) => card.status === "active")
      .slice(0, 30)
      .map((card) => ({
        sourceType: "meal_card" as const,
        sourceId: card.id,
        text: [card.text, card.time, card.place, card.people, ...card.tags].filter(Boolean).join(" "),
        rawTags: card.tags,
        metadata: { place: card.place, tags: card.tags },
      })),
    ...posts.slice(0, 30).map((post) => ({
      sourceType: "post" as const,
      sourceId: post.id,
      text: [post.title, post.text, post.topic, post.place, post.channel].filter(Boolean).join(" "),
      rawTags: [post.topic, post.place, post.channel].filter(Boolean),
      metadata: { topic: post.topic, place: post.place, channel: post.channel },
    })),
    ...comments.slice(0, 30).map((comment) => ({
      sourceType: "comment" as const,
      sourceId: comment.id,
      text: comment.text,
      metadata: { postId: comment.postId },
    })),
  ].filter((draft) => draft.text.trim());

  await postgresStore.markAiMemoryItemsDeletedForUser(userId);
  const memoryItems = await Promise.all(
    drafts.map((draft) => {
      const inlineEmbedding = createInlineMemoryEmbedding(draft.text);
      return postgresStore.upsertAiMemoryItem({
        id: makeId("ai-mem"),
        userId,
        sourceType: draft.sourceType,
        sourceId: draft.sourceId,
        text: draft.text.trim().slice(0, 400),
        canonicalTags: buildCanonicalTags(draft),
        embedding: inlineEmbedding?.embedding ?? [],
        embeddingModel: inlineEmbedding?.modelVersion,
        metadata: draft.metadata,
      });
    })
  );
  queueAiMemoryEmbeddingBackfill(memoryItems);

  const profile = buildProfile(memoryItems);
  refreshedAtByUserId.set(userId, Date.now());
  return postgresStore.updateUserAiProfile(userId, profile);
}

export function queueUserAiProfileRefresh(userId: string) {
  if (process.env.AI_PROFILE_ENABLED === "false") return;
  refreshedAtByUserId.delete(userId);
  setTimeout(() => {
    refreshUserAiProfile(userId).catch((error) => {
      console.warn("Failed to refresh AI user profile.", error);
    });
  }, 0);
}

function rankEvidenceSignals(
  memories: AiMemoryItem[],
  memberUserIds: string[],
  currentUserId: string,
  queryTags: string[]
): AiEvidenceSignal[] {
  const memoriesByUser = new Map<string, AiMemoryItem[]>();
  for (const memory of memories) {
    memoriesByUser.set(memory.userId, [...(memoriesByUser.get(memory.userId) ?? []), memory]);
  }

  const tagCountsByUser = new Map<string, Map<string, number>>();
  for (const userId of memberUserIds) {
    const tagCounts = new Map<string, number>();
    for (const memory of memoriesByUser.get(userId) ?? []) {
      const weight = sourceWeights[memory.sourceType] ?? 1;
      for (const tag of memory.canonicalTags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + weight);
    }
    tagCountsByUser.set(userId, tagCounts);
  }

  const currentTags = tagCountsByUser.get(currentUserId) ?? new Map<string, number>();
  const otherUserIds = memberUserIds.filter((userId) => userId !== currentUserId);
  const signals: AiEvidenceSignal[] = [];

  for (const [tag, currentCount] of currentTags) {
    const otherCount = otherUserIds.reduce((sum, userId) => sum + (tagCountsByUser.get(userId)?.get(tag) ?? 0), 0);
    if (!otherCount) continue;
    signals.push({
      tag: `shared:${tag}`,
      label: labelForTag(tag),
      score: currentCount * 0.9 + otherCount + (queryTags.includes(tag) ? 2.5 : 0),
      evidence: evidenceForTag(memories, tag, [currentUserId, ...otherUserIds]),
      kind: "shared",
    });
  }

  for (const tag of queryTags) {
    const otherCount = otherUserIds.reduce((sum, userId) => sum + (tagCountsByUser.get(userId)?.get(tag) ?? 0), 0);
    if (!otherCount) continue;
    signals.push({
      tag: `query:${tag}`,
      label: labelForTag(tag),
      score: otherCount + 3,
      evidence: evidenceForTag(memories, tag, otherUserIds),
      kind: "query",
    });
  }

  for (const rule of complementaryRules) {
    const currentHasPrimary = currentTags.has(rule.tag);
    const currentHasSecondary = currentTags.has(rule.withTag);
    const otherPrimaryScore = otherUserIds.reduce((sum, userId) => sum + (tagCountsByUser.get(userId)?.get(rule.tag) ?? 0), 0);
    const otherSecondaryScore = otherUserIds.reduce((sum, userId) => sum + (tagCountsByUser.get(userId)?.get(rule.withTag) ?? 0), 0);
    const matched =
      (currentHasPrimary && otherSecondaryScore > 0) ||
      (currentHasSecondary && otherPrimaryScore > 0);
    if (!matched) continue;
    const evidence = [
      ...evidenceForTag(memories, rule.tag, [currentUserId, ...otherUserIds]),
      ...evidenceForTag(memories, rule.withTag, [currentUserId, ...otherUserIds]),
    ].slice(0, 3);
    signals.push({
      tag: `complementary:${rule.tag}:${rule.withTag}`,
      label: rule.label,
      score: 5 + otherPrimaryScore + otherSecondaryScore,
      evidence: evidence.length ? evidence : [rule.reasonLabel],
      kind: "complementary",
    });
  }

  const otherSignals = otherUserIds
    .flatMap((userId) => Array.from(tagCountsByUser.get(userId)?.entries() ?? []))
    .sort((a, b) => b[1] - a[1])
    .slice(0, signals.length ? 2 : 4)
    .map(([tag, count]) => ({
      tag: `target:${tag}`,
      label: labelForTag(tag),
      score: count * 0.7,
      evidence: evidenceForTag(memories, tag, otherUserIds),
      kind: "target" as const,
    }));
  signals.push(...otherSignals);

  return signals.sort((a, b) => b.score - a.score);
}

async function rankVectorEvidenceSignals(
  memories: AiMemoryItem[],
  memberUserIds: string[],
  currentUserId: string,
  queryText: string,
  options: BuildConversationEvidenceOptions = {}
): Promise<AiEvidenceSignal[]> {
  if (!shouldUseEmbeddings()) return [];

  const otherUserIds = memberUserIds.filter((userId) => userId !== currentUserId);
  const embeddingConfig = readEmbeddingConfig();
  const recallModel = embeddingConfig.modelVersion;
  const query = queryText.trim();
  const queryEmbeddingResult = await createQueryEmbeddingForRecall(query, options);
  if (queryEmbeddingResult?.embedding.length && queryEmbeddingResult.modelVersion) {
    const queryEmbedding = queryEmbeddingResult.embedding;
    const queryModel = queryEmbeddingResult.modelVersion;
    const pgvectorMatches = await postgresStore.searchAiMemoryItemsByVector(otherUserIds, queryEmbedding, 8, queryModel);
    const matches = pgvectorMatches.length
      ? pgvectorMatches
          .map((memory) => ({ memory, score: cosineSimilarity(queryEmbedding, memory.embedding) }))
          .filter((match) => match.score >= semanticQueryThreshold(queryModel, true))
          .sort((a, b) => b.score - a.score)
          .map((match) => match.memory)
      : memories
          .filter((memory) => otherUserIds.includes(memory.userId) && memory.embedding.length && memory.embeddingModel === queryModel)
          .map((memory) => ({ memory, score: cosineSimilarity(queryEmbedding, memory.embedding) }))
          .filter((match) => match.score >= semanticQueryThreshold(queryModel, false))
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
          .map((match) => match.memory);

    if (matches.length) {
      return [
        {
          tag: "semantic_query_match",
          label: "贴近当前话题",
          score: matches.length + 1,
          evidence: matches.slice(0, 3).map((memory) => `${sourceLabel(memory.sourceType)}：${clipText(memory.text, 28)}`),
          kind: "query",
        },
      ];
    }
  }

  const currentMemories = memories
    .filter((memory) => memory.userId === currentUserId && memory.embedding.length && memory.embeddingModel === recallModel)
    .slice(0, 40);
  const otherMemories = memories
    .filter((memory) => otherUserIds.includes(memory.userId) && memory.embedding.length && memory.embeddingModel === recallModel)
    .slice(0, 80);
  let bestPair: { current: AiMemoryItem; other: AiMemoryItem; score: number } | undefined;

  for (const current of currentMemories) {
    for (const other of otherMemories) {
      const score = cosineSimilarity(current.embedding, other.embedding);
      if (score < 0.55) continue;
      if (!bestPair || score > bestPair.score) bestPair = { current, other, score };
    }
  }

  if (!bestPair) return [];
  return [
    {
      tag: "semantic_shared_public_content",
      label: "相似公开内容",
      score: bestPair.score * 10,
      evidence: [
        `${sourceLabel(bestPair.current.sourceType)}：${clipText(bestPair.current.text, 28)}`,
        `${sourceLabel(bestPair.other.sourceType)}：${clipText(bestPair.other.text, 28)}`,
      ],
      kind: "shared",
    },
  ];
}

async function createQueryEmbeddingForRecall(query: string, options: BuildConversationEvidenceOptions) {
  if (!query) return undefined;
  const config = readEmbeddingConfig();
  if (config.provider === "hash" && config.modelVersion) return createFallbackEmbedding(query);
  if (config.provider !== "ollama" || !config.modelVersion || !options.allowRealtimeQueryEmbedding) return undefined;
  try {
    const result = await createEmbedding(query, { allowFallback: false });
    if (result?.modelVersion !== config.modelVersion) return undefined;
    return result;
  } catch (error) {
    console.warn("Failed to create realtime query embedding for AI evidence.", error);
    return undefined;
  }
}

function semanticQueryThreshold(modelVersion: string, usedPgvector: boolean) {
  if (modelVersion.startsWith("ollama:")) return usedPgvector ? 0.42 : 0.48;
  return usedPgvector ? 0.34 : 0.42;
}

function uniqueSignals(signals: AiEvidenceSignal[]) {
  const seen = new Set<string>();
  return signals
    .filter((signal) => {
      const key = signal.tag;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

function buildProfile(memoryItems: AiMemoryItem[]) {
  const tagCounts = new Map<string, number>();
  const sourceCounts: Record<string, number> = {};
  for (const item of memoryItems) {
    sourceCounts[item.sourceType] = (sourceCounts[item.sourceType] ?? 0) + 1;
    const weight = sourceWeights[item.sourceType] ?? 1;
    for (const tag of item.canonicalTags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + weight);
  }

  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag, score]) => ({ tag, label: labelForTag(tag), score: Number(score.toFixed(2)) }));

  return {
    version: profileVersion,
    topTags,
    dimensions: buildProfileDimensions(topTags),
    evidenceSamples: memoryItems.slice(0, 8).map((item) => ({
      sourceType: item.sourceType,
      text: clipText(item.text, 42),
      tags: item.canonicalTags.slice(0, 4),
    })),
    confidence: estimateProfileConfidence(memoryItems, topTags.length),
    sourceCounts,
    embeddingModel: readEmbeddingConfig().modelVersion,
    updatedBy: "public-content-indexer",
  };
}

function extractCanonicalTags(text: string) {
  return extractSharedCanonicalTags(text);
}

function buildCanonicalTags(draft: MemoryDraft) {
  return buildSharedCanonicalTags(draft);
}

function normalizeCustomTag(tag: string) {
  const normalized = tag.replace(/\s+/g, "").replace(/[，。！？、,.!?;；:："'`]/g, "").trim();
  if (normalized.length < 2 || normalized.length > 14) return undefined;
  if (/^(全部|其他|默认|无|暂无|不限|随便|未知)$/.test(normalized)) return undefined;
  return normalized;
}

function evidenceForTag(memories: AiMemoryItem[], tag: string, preferredUserIds: string[]) {
  const preferred = new Set(preferredUserIds);
  return memories
    .filter((memory) => preferred.has(memory.userId) && memory.canonicalTags.includes(tag))
    .slice(0, 3)
    .map((memory) => `${sourceLabel(memory.sourceType)}：${clipText(memory.text, 28)}`);
}

function buildReason(signals: AiEvidenceSignal[]) {
  if (!signals.length) return undefined;
  const shared = signals.find((signal) => signal.kind === "shared");
  const complementary = signals.find((signal) => signal.kind === "complementary");
  const query = signals.find((signal) => signal.kind === "query");
  const current = signals.find((signal) => signal.kind === "current");
  if (shared && complementary) return `因为你们有${shared.label}相关共同点，也能从${complementary.label}轻松切入。`;
  if (shared) return `因为你们的公开内容里都出现过${shared.label}相关线索。`;
  if (query) return `因为当前话题和对方公开内容里的${query.label}比较接近。`;
  if (complementary) return `因为公开内容里有${complementary.label}这类可接上的线索。`;
  if (current) return "公开画像线索还不多，先根据当前话题给你几条稳妥开场。";
  const labels = signals.slice(0, 2).map((signal) => signal.label);
  return `因为公开内容里出现过${labels.join("、")}相关线索。`;
}

function labelForTag(tag: string) {
  return labelForSemanticTag(tag);
}

function sourceLabel(sourceType: AiMemorySourceType) {
  if (sourceType === "meal_card") return "饭卡";
  if (sourceType === "post") return "帖子";
  if (sourceType === "comment") return "评论";
  return "标签";
}

function buildProfileDimensions(topTags: Array<{ tag: string; label: string; score: number }>) {
  const dimensions: Record<string, Array<{ tag: string; label: string; score: number }>> = {};
  for (const tag of topTags) {
    const dimension = getTagDimension(tag.tag);
    dimensions[dimension] = [...(dimensions[dimension] ?? []), tag];
  }
  return dimensions;
}

function summarizeProfile(profile: UserAiProfile, role: "current" | "other"): AiProfileSummary {
  const rawProfile = profile.profile as {
    topTags?: Array<{ tag: string; label: string; score?: number; count?: number }>;
    dimensions?: Record<string, Array<{ tag: string; label: string; score?: number }>>;
    confidence?: number;
  };
  const topTags = Array.isArray(rawProfile.topTags) ? rawProfile.topTags : [];
  const dimensions = normalizeProfileDimensions(rawProfile.dimensions, topTags);
  return {
    userId: profile.userId,
    role,
    topLabels: topTags.slice(0, 5).map((tag) => tag.label),
    dimensions,
    confidence: typeof rawProfile.confidence === "number" ? rawProfile.confidence : estimateProfileConfidenceFromTags(topTags.length),
  };
}

function normalizeProfileDimensions(
  dimensions: Record<string, Array<{ tag: string; label: string; score?: number }>> | undefined,
  topTags: Array<{ tag: string; label: string; score?: number; count?: number }>
) {
  if (dimensions && Object.keys(dimensions).length) {
    return Object.fromEntries(
      Object.entries(dimensions).map(([key, values]) => [
        key,
        values.slice(0, 5).map((item) => ({ tag: item.tag, label: item.label, score: Number((item.score ?? 0).toFixed(2)) })),
      ])
    );
  }
  return buildProfileDimensions(
    topTags.slice(0, 12).map((tag) => ({
      tag: tag.tag,
      label: tag.label,
      score: Number((tag.score ?? tag.count ?? 0).toFixed(2)),
    }))
  );
}

function estimateProfileConfidence(memoryItems: AiMemoryItem[], topTagCount: number) {
  const sourceKinds = new Set(memoryItems.map((item) => item.sourceType)).size;
  const raw = memoryItems.length * 0.04 + sourceKinds * 0.12 + topTagCount * 0.035;
  return Number(Math.max(0.15, Math.min(0.92, raw)).toFixed(2));
}

function estimateProfileConfidenceFromTags(topTagCount: number) {
  return Number(Math.max(0.12, Math.min(0.72, topTagCount * 0.08)).toFixed(2));
}

function stableSourceId(sourceType: AiMemorySourceType, text: string) {
  return `${sourceType}:${createHash("sha256").update(text).digest("hex").slice(0, 16)}`;
}

function clipText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function shouldUseEmbeddings() {
  return readEmbeddingConfig().provider !== "disabled";
}

function createTextEmbedding(text: string) {
  return createFallbackEmbedding(text).embedding;
}

function createInlineMemoryEmbedding(text: string) {
  if (!shouldCreateInlineEmbeddings()) return undefined;
  return createFallbackEmbedding(text);
}

function queueAiMemoryEmbeddingBackfill(items: AiMemoryItem[]) {
  if (!shouldQueueEmbeddingBackfill()) return;
  const targetModel = readEmbeddingConfig().modelVersion;
  if (!targetModel) return;
  void enqueueAiMemoryEmbeddingJobs(items, targetModel).catch((error) => {
    console.warn("Failed to enqueue AI memory embedding jobs.", error);
  });
  for (const item of items) {
    if (!item.text.trim()) continue;
    if (item.embeddingModel === targetModel && item.embedding.length) continue;
    pendingEmbeddingItems.set(item.id, item);
  }
  if (embeddingBackfillRunning || !pendingEmbeddingItems.size) return;
  setTimeout(() => {
    processQueuedEmbeddingBackfill().catch((error) => {
      console.warn("Failed to process AI memory embedding queue.", error);
    });
  }, 0);
}

async function processQueuedEmbeddingBackfill() {
  if (embeddingBackfillRunning) return;
  embeddingBackfillRunning = true;
  const batchSize = readPositiveInteger(process.env.AI_EMBEDDING_BACKFILL_BATCH_SIZE, 12);
  const targetModel = readEmbeddingConfig().modelVersion;
  try {
    if (!targetModel) return;
    let processed = 0;
    while (pendingEmbeddingItems.size && processed < batchSize) {
      const [memoryId, item] = pendingEmbeddingItems.entries().next().value as [string, AiMemoryItem];
      pendingEmbeddingItems.delete(memoryId);
      processed += 1;
      const jobId = stableEmbeddingJobId("ai_memory_item", item.id, targetModel);
      try {
        const result = await createEmbedding(item.text, { allowFallback: true });
        if (!result?.embedding.length) {
          await postgresStore.failAiEmbeddingJob(jobId, "embedding provider returned an empty vector");
          continue;
        }
        await postgresStore.updateAiMemoryEmbedding(item.id, result.embedding, result.modelVersion);
        if (result.modelVersion === targetModel) {
          await postgresStore.completeAiEmbeddingJob(jobId);
        } else {
          await postgresStore.failAiEmbeddingJob(jobId, `fallback embedding written: ${result.modelVersion}`);
        }
      } catch (error) {
        await postgresStore.failAiEmbeddingJob(jobId, getErrorMessage(error));
      }
    }
  } finally {
    embeddingBackfillRunning = false;
    if (pendingEmbeddingItems.size) {
      setTimeout(() => {
        processQueuedEmbeddingBackfill().catch((error) => {
          console.warn("Failed to continue AI memory embedding queue.", error);
        });
      }, 0);
    }
  }
}

export async function backfillAiMemoryEmbeddings(limit = 100) {
  const startedAt = Date.now();
  if (!shouldQueueEmbeddingBackfill()) {
    const config = readEmbeddingConfig();
    return {
      provider: config.provider,
      targetModelVersion: config.modelVersion,
      targetDimensions: config.vectorDimensions,
      scanned: 0,
      updated: 0,
      targetUpdated: 0,
      fallbackUpdated: 0,
      skipped: 0,
      failed: 0,
      elapsedMs: Date.now() - startedAt,
      reason: "embedding provider is not ollama",
    };
  }
  const config = readEmbeddingConfig();
  if (!config.modelVersion) {
    return {
      provider: config.provider,
      targetModelVersion: undefined,
      targetDimensions: config.vectorDimensions,
      scanned: 0,
      updated: 0,
      targetUpdated: 0,
      fallbackUpdated: 0,
      skipped: 0,
      failed: 0,
      elapsedMs: Date.now() - startedAt,
      reason: "embedding model version is unavailable",
    };
  }

  const staleReset = await postgresStore.resetStaleAiEmbeddingJobs(
    readPositiveInteger(process.env.AI_EMBEDDING_JOB_STALE_MS, 30 * 60 * 1000)
  );
  const items = await postgresStore.listAiMemoryItemsNeedingEmbedding(config.modelVersion, limit);
  const enqueued = await enqueueAiMemoryEmbeddingJobs(items, config.modelVersion);
  const jobs = await postgresStore.claimAiEmbeddingJobs(
    config.modelVersion,
    limit,
    `ai-memory-${process.pid}-${Date.now()}`,
    ["ai_memory_item"]
  );
  const maxRetries = readPositiveInteger(process.env.AI_EMBEDDING_JOB_MAX_RETRIES, 8);
  const retryBaseMs = readPositiveInteger(process.env.AI_EMBEDDING_JOB_RETRY_BASE_MS, 5 * 60 * 1000);
  let updated = 0;
  let targetUpdated = 0;
  let fallbackUpdated = 0;
  let skipped = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      const item = await postgresStore.findAiMemoryItemById(job.targetId);
      if (!item) {
        skipped += 1;
        await postgresStore.completeAiEmbeddingJob(job.id);
        continue;
      }
      const currentTextHash = stableTextHash(item.text);
      if (currentTextHash !== job.textHash) {
        skipped += 1;
        await enqueueAiMemoryEmbeddingJobs([item], config.modelVersion);
        continue;
      }
      if (item.embeddingModel === config.modelVersion && item.embedding.length) {
        skipped += 1;
        await postgresStore.completeAiEmbeddingJob(job.id);
        continue;
      }
      const result = await createEmbedding(item.text, { allowFallback: true });
      if (!result?.embedding.length) {
        skipped += 1;
        await postgresStore.failAiEmbeddingJob(job.id, "embedding provider returned an empty vector", {
          final: job.retryCount + 1 >= maxRetries,
          retryDelayMs: retryDelayForAttempt(job.retryCount + 1, retryBaseMs),
        });
        continue;
      }
      await postgresStore.updateAiMemoryEmbedding(item.id, result.embedding, result.modelVersion);
      updated += 1;
      if (result.modelVersion === config.modelVersion) {
        targetUpdated += 1;
        await postgresStore.completeAiEmbeddingJob(job.id);
      } else {
        fallbackUpdated += 1;
        await postgresStore.failAiEmbeddingJob(job.id, `fallback embedding written: ${result.modelVersion}`, {
          final: job.retryCount + 1 >= maxRetries,
          retryDelayMs: retryDelayForAttempt(job.retryCount + 1, retryBaseMs),
        });
      }
    } catch (error) {
      failed += 1;
      await postgresStore.failAiEmbeddingJob(job.id, getErrorMessage(error), {
        final: job.retryCount + 1 >= maxRetries,
        retryDelayMs: retryDelayForAttempt(job.retryCount + 1, retryBaseMs),
      });
      console.warn(`Failed to backfill AI memory embedding job ${job.id}.`, error);
    }
  }
  const jobStats = await postgresStore.getAiEmbeddingJobStats(config.modelVersion);
  return {
    provider: config.provider,
    targetModelVersion: config.modelVersion,
    targetDimensions: config.vectorDimensions,
    scanned: items.length,
    enqueued,
    claimed: jobs.length,
    staleReset,
    updated,
    targetUpdated,
    fallbackUpdated,
    skipped,
    failed,
    jobStats,
    elapsedMs: Date.now() - startedAt,
  };
}

async function enqueueAiMemoryEmbeddingJobs(items: AiMemoryItem[], targetModel: string) {
  let enqueued = 0;
  for (const item of items) {
    if (!item.text.trim()) continue;
    if (item.embeddingModel === targetModel && item.embedding.length) continue;
    await postgresStore.upsertAiEmbeddingJob({
      id: stableEmbeddingJobId("ai_memory_item", item.id, targetModel),
      targetType: "ai_memory_item",
      targetId: item.id,
      textHash: stableTextHash(item.text),
      embeddingModel: targetModel,
      priority: embeddingJobPriority(item.sourceType),
    });
    enqueued += 1;
  }
  return enqueued;
}

function stableEmbeddingJobId(targetType: string, targetId: string, embeddingModel: string) {
  const digest = createHash("sha256").update(`${targetType}:${targetId}:${embeddingModel}`).digest("hex").slice(0, 24);
  return `ai-emb-${digest}`;
}

function stableTextHash(text: string) {
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 32);
}

function embeddingJobPriority(sourceType: AiMemorySourceType) {
  if (sourceType === "meal_card") return 80;
  if (sourceType === "profile_tag") return 70;
  if (sourceType === "post") return 50;
  return 40;
}

function retryDelayForAttempt(attempt: number, baseMs: number) {
  return Math.min(60 * 60 * 1000, baseMs * Math.max(1, Math.min(6, attempt)));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return vector;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function cosineSimilarity(left: number[], right: number[]) {
  return semanticCosineSimilarity(left, right);
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
