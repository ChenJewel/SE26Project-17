import { createHash } from "node:crypto";
import { postgresStore } from "../data/postgres.js";
import { makeId } from "../data/store.js";
import type { AiMemoryItem, AiMemorySourceType, Conversation, UserAiProfile } from "../types.js";

export interface AiEvidenceSignal {
  tag: string;
  label: string;
  score: number;
  evidence: string[];
}

export interface AiEvidenceResult {
  signals: AiEvidenceSignal[];
  reason?: string;
}

interface MemoryDraft {
  sourceType: AiMemorySourceType;
  sourceId: string;
  text: string;
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

const profileRefreshMs = readPositiveInteger(process.env.AI_PROFILE_REFRESH_MS, 10 * 60 * 1000);
const embeddingModel = process.env.AI_EMBEDDING_MODEL || "local-hash-embedding-v1";
const refreshedAtByUserId = new Map<string, number>();

export async function buildConversationEvidence(conversation: Conversation, currentUserId: string, queryText = ""): Promise<AiEvidenceResult> {
  if (process.env.AI_PROFILE_ENABLED === "false" || process.env.AI_RECALL_ENABLED === "false") {
    return { signals: [] };
  }

  const memberUserIds = conversation.memberUserIds.slice(0, 6);
  await Promise.all(memberUserIds.map((userId) => refreshUserAiProfile(userId)));
  const memories = await postgresStore.listAiMemoryItemsForUsers(memberUserIds, 180);
  const signals = uniqueSignals([
    ...rankEvidenceSignals(memories, memberUserIds, currentUserId),
    ...(await rankVectorEvidenceSignals(memories, memberUserIds, currentUserId, queryText)),
  ]).slice(0, 4);
  return {
    signals,
    reason: buildReason(signals),
  };
}

export async function refreshUserAiProfile(userId: string): Promise<UserAiProfile> {
  const lastRefreshAt = refreshedAtByUserId.get(userId) ?? 0;
  const currentProfile = await postgresStore.getUserAiProfile(userId);
  if (Date.now() - lastRefreshAt < profileRefreshMs && Object.keys(currentProfile.profile).length) {
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
      metadata: { source: "preferenceTags" },
    })),
    ...mealCards
      .filter((card) => card.status === "active")
      .slice(0, 30)
      .map((card) => ({
        sourceType: "meal_card" as const,
        sourceId: card.id,
        text: [card.text, card.time, card.place, card.people, ...card.tags].filter(Boolean).join(" "),
        metadata: { place: card.place, tags: card.tags },
      })),
    ...posts.slice(0, 30).map((post) => ({
      sourceType: "post" as const,
      sourceId: post.id,
      text: [post.title, post.text, post.topic, post.place, post.channel].filter(Boolean).join(" "),
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
        canonicalTags: extractCanonicalTags(draft.text),
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

function rankEvidenceSignals(memories: AiMemoryItem[], memberUserIds: string[], currentUserId: string): AiEvidenceSignal[] {
  const memoriesByUser = new Map<string, AiMemoryItem[]>();
  for (const memory of memories) {
    memoriesByUser.set(memory.userId, [...(memoriesByUser.get(memory.userId) ?? []), memory]);
  }

  const tagCountsByUser = new Map<string, Map<string, number>>();
  for (const userId of memberUserIds) {
    const tagCounts = new Map<string, number>();
    for (const memory of memoriesByUser.get(userId) ?? []) {
      for (const tag of memory.canonicalTags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
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
      tag,
      label: labelForTag(tag),
      score: currentCount + otherCount,
      evidence: evidenceForTag(memories, tag, [currentUserId, ...otherUserIds]),
    });
  }

  if (!signals.length) {
    const otherSignals = otherUserIds
      .flatMap((userId) => Array.from(tagCountsByUser.get(userId)?.entries() ?? []))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([tag, count]) => ({
        tag,
        label: labelForTag(tag),
        score: count,
        evidence: evidenceForTag(memories, tag, otherUserIds),
      }));
    signals.push(...otherSignals);
  }

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
          label: "相似公开内容",
          score: matches.length + 1,
          evidence: matches.slice(0, 3).map((memory) => `${sourceLabel(memory.sourceType)}：${clipText(memory.text, 28)}`),
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
    for (const tag of item.canonicalTags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag, count]) => ({ tag, label: labelForTag(tag), count }));

  return {
    version: "m2-rule-profile-v1",
    topTags,
    sourceCounts,
    embeddingModel: shouldUseEmbeddings() ? embeddingModel : undefined,
    updatedBy: "public-content-indexer",
  };
}

function extractCanonicalTags(text: string) {
  const normalized = text.toLowerCase();
  const tags = taxonomy
    .filter((entry) => entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())))
    .map((entry) => entry.tag);
  return Array.from(new Set(tags));
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
  const labels = signals.slice(0, 2).map((signal) => signal.label);
  return `因为公开内容里出现过${labels.join("、")}相关线索。`;
}

function labelForTag(tag: string) {
  return taxonomy.find((entry) => entry.tag === tag)?.label ?? tag;
}

function sourceLabel(sourceType: AiMemorySourceType) {
  if (sourceType === "meal_card") return "饭卡";
  if (sourceType === "post") return "帖子";
  if (sourceType === "comment") return "评论";
  return "标签";
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
