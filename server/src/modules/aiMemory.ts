import { createHash } from "node:crypto";
import { postgresStore } from "../data/postgres.js";
import { makeId } from "../data/store.js";
import type { AiMemoryItem, AiMemorySourceType, Conversation, UserAiProfile } from "../types.js";

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
const embeddingModel = process.env.AI_EMBEDDING_MODEL || "local-hash-embedding-v1";
const profileVersion = "m3-profile-match-v2";
const refreshedAtByUserId = new Map<string, number>();

export async function buildConversationEvidence(conversation: Conversation, currentUserId: string, queryText = ""): Promise<AiEvidenceResult> {
  if (process.env.AI_PROFILE_ENABLED === "false" || process.env.AI_RECALL_ENABLED === "false") {
    return { signals: [] };
  }

  const memberUserIds = conversation.memberUserIds.slice(0, 6);
  const profiles = await Promise.all(memberUserIds.map((userId) => refreshUserAiProfile(userId)));
  const memories = await postgresStore.listAiMemoryItemsForUsers(memberUserIds, 180);
  const queryTags = extractCanonicalTags(queryText);
  const signals = uniqueSignals([
    ...rankEvidenceSignals(memories, memberUserIds, currentUserId, queryTags),
    ...(await rankVectorEvidenceSignals(memories, memberUserIds, currentUserId, queryText)),
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
    drafts.map((draft) =>
      postgresStore.upsertAiMemoryItem({
        id: makeId("ai-mem"),
        userId,
        sourceType: draft.sourceType,
        sourceId: draft.sourceId,
        text: draft.text.trim().slice(0, 400),
        canonicalTags: buildCanonicalTags(draft),
        embedding: shouldUseEmbeddings() ? createTextEmbedding(draft.text) : [],
        embeddingModel: shouldUseEmbeddings() ? embeddingModel : undefined,
        metadata: draft.metadata,
      })
    )
  );

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
  queryText: string
): Promise<AiEvidenceSignal[]> {
  if (!shouldUseEmbeddings()) return [];

  const otherUserIds = memberUserIds.filter((userId) => userId !== currentUserId);
  const query = queryText.trim();
  if (query) {
    const queryEmbedding = createTextEmbedding(query);
    const pgvectorMatches = await postgresStore.searchAiMemoryItemsByVector(otherUserIds, queryEmbedding, 8);
    const matches = pgvectorMatches.length
      ? pgvectorMatches
          .map((memory) => ({ memory, score: cosineSimilarity(queryEmbedding, memory.embedding) }))
          .filter((match) => match.score >= 0.34)
          .sort((a, b) => b.score - a.score)
          .map((match) => match.memory)
      : memories
          .filter((memory) => otherUserIds.includes(memory.userId) && memory.embedding.length)
          .map((memory) => ({ memory, score: cosineSimilarity(queryEmbedding, memory.embedding) }))
          .filter((match) => match.score >= 0.42)
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

  const currentMemories = memories.filter((memory) => memory.userId === currentUserId && memory.embedding.length).slice(0, 40);
  const otherMemories = memories.filter((memory) => otherUserIds.includes(memory.userId) && memory.embedding.length).slice(0, 80);
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
    embeddingModel: shouldUseEmbeddings() ? embeddingModel : undefined,
    updatedBy: "public-content-indexer",
  };
}

function extractCanonicalTags(text: string) {
  const normalized = text.toLowerCase();
  const tags = allTaxonomy
    .filter((entry) => entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())))
    .map((entry) => entry.tag);
  return Array.from(new Set(tags));
}

function buildCanonicalTags(draft: MemoryDraft) {
  const semanticTags = extractCanonicalTags(draft.text);
  const customTags = (draft.rawTags ?? [])
    .map((tag) => normalizeCustomTag(tag))
    .filter((tag): tag is string => Boolean(tag))
    .map((tag) => `custom:${tag}`);
  return Array.from(new Set([...semanticTags, ...customTags])).slice(0, 8);
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
  if (tag.startsWith("custom:")) return tag.slice("custom:".length);
  return allTaxonomy.find((entry) => entry.tag === tag)?.label ?? tag.replace(/^(shared|query|target):/, "");
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
    const dimension = tag.tag.startsWith("custom:") ? "custom" : tagDimensions[tag.tag] ?? "other";
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
  return process.env.AI_EMBEDDING_ENABLED !== "false";
}

function createTextEmbedding(text: string) {
  const dimensions = 64;
  const vector = Array.from({ length: dimensions }, () => 0);
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return vector;

  for (let index = 0; index < normalized.length; index += 1) {
    const gram = normalized.slice(index, index + 2);
    const hash = createHash("sha256").update(gram).digest();
    const dimension = hash[0] % dimensions;
    const sign = hash[1] % 2 === 0 ? 1 : -1;
    vector[dimension] += sign;
  }

  return normalizeVector(vector);
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return vector;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;
  let score = 0;
  for (let index = 0; index < length; index += 1) {
    score += left[index] * right[index];
  }
  return score;
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
