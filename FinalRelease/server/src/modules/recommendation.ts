import type { AiMemoryItem, MealCard, MealCardRecommendationCache, MealExchangeRequest, User, UserAiProfile } from "../types.js";
import { getMealCardScheduleDate, getMealCardScheduleScore } from "../common/mealCardVisibility.js";
import {
  cosineSimilarity,
  extractCanonicalTags,
  getTagDimension,
  labelForTag,
  normalizeRawToken,
  normalizeSemanticTokens,
  normalizeToCanonicalTag,
} from "./semanticSignals.js";

export interface MealCardRecommendationContext {
  currentUser: User;
  authorById: Map<string, User>;
  blockedUserIds: Set<string>;
  userReportCounts: Map<string, number>;
  cardReportCounts: Map<string, number>;
  exchangeRequests: MealExchangeRequest[];
  currentUserAiProfile?: UserAiProfile;
  authorAiProfiles?: Map<string, UserAiProfile>;
  aiMemoryItems?: AiMemoryItem[];
  recommendationCaches?: Map<string, MealCardRecommendationCache>;
  now?: Date;
}

interface ScoredMealCard {
  card: MealCard;
  score: number;
  reason: string;
  createdAtMs: number;
  scheduleAtMs: number;
}

interface InterestScoreResult {
  score: number;
  legacyScore: number;
  semanticScore: number;
  semanticReasons: string[];
}

const highRiskReportThreshold = 5;

const canonicalTagGroups: Record<string, string[]> = {
  japanese_food: ["日本菜", "日料", "日式", "日式食物", "日本料理", "居酒屋", "寿司", "刺身", "拉面", "乌冬"],
  korean_food: ["韩餐", "韩国菜", "韩国料理", "烤肉", "部队锅", "拌饭", "炸鸡"],
  spicy_food: ["辣", "吃辣", "喜欢吃辣", "重口", "重口味", "川菜", "湘菜", "麻辣", "火锅", "串串"],
  light_food: ["清淡", "不吃辣", "少油", "轻食", "沙拉", "健康餐"],
  dessert_drink: ["奶茶", "咖啡", "甜品", "蛋糕", "面包", "饮品"],
  canteen: ["食堂", "一食堂", "二食堂", "三食堂", "四食堂", "校园", "校内"],
  quiet_dining: ["安静", "安静一点", "少说话", "不吵", "慢热", "低压力", "舒服"],
  social_chat: ["聊天", "可以聊天", "闲聊", "随便聊", "话题", "社恐友好"],
};

const canonicalTagAliases = new Map(
  Object.entries(canonicalTagGroups).flatMap(([canonical, aliases]) => aliases.map((alias) => [normalizeRawToken(alias), canonical] as const))
);

export function rankMealCardsForUser(cards: MealCard[], context: MealCardRecommendationContext) {
  const scoredCards = cards
    .filter((card) => isRecommendableCard(card, context))
    .map((card) => scoreMealCardForUser(card, context))
    .sort((left, right) => right.score - left.score || left.scheduleAtMs - right.scheduleAtMs || right.createdAtMs - left.createdAtMs);

  return scoredCards.map(({ card, score, reason }) => ({
    ...card,
    matchScore: clampInt(Math.round(score * 100), 1, 99),
    reason,
  }));
}

function isRecommendableCard(card: MealCard, context: MealCardRecommendationContext) {
  if (card.status !== "active") return false;
  if (card.userId === context.currentUser.id) return false;
  if (context.blockedUserIds.has(card.userId)) return false;
  if ((context.userReportCounts.get(card.userId) ?? 0) >= highRiskReportThreshold) return false;
  if ((context.cardReportCounts.get(card.id) ?? 0) >= highRiskReportThreshold) return false;
  return true;
}

function scoreMealCardForUser(card: MealCard, context: MealCardRecommendationContext): ScoredMealCard {
  const author = context.authorById.get(card.userId);
  const interest = getInterestScore(context.currentUser, card, author, context);
  const interestScore = interest.score;
  const reciprocalScore = getReciprocalScore(context.currentUser, card, author, interestScore, context.exchangeRequests);
  const sceneScore = getSceneScore(context.currentUser, card, context.now ?? new Date());
  const behaviorScore = getBehaviorScore(context.currentUser.id, card, context.exchangeRequests);
  const trustScore = getTrustScore(author, card, context.userReportCounts.get(card.userId) ?? 0);
  const qualityScore = getQualityScore(card);
  const freshnessScore = getFreshnessScore(card, context.now ?? new Date());
  const explorationScore = getExplorationScore(card);
  const penalty = getPenalty(context.currentUser.id, card, context);

  const score = clamp01(
    reciprocalScore * 0.25 +
      sceneScore * 0.22 +
      interestScore * 0.2 +
      behaviorScore * 0.13 +
      trustScore * 0.08 +
      qualityScore * 0.07 +
      freshnessScore * 0.03 +
      explorationScore * 0.02 -
      penalty
  );

  return {
    card,
    score,
    reason: buildReason({
      currentUser: context.currentUser,
      author,
      card,
      interestScore,
      semanticScore: interest.semanticScore,
      semanticReasons: interest.semanticReasons,
      reciprocalScore,
      sceneScore,
      behaviorScore,
      trustScore,
      qualityScore,
      freshnessScore,
    }),
    createdAtMs: parseTime(card.createdAt),
    scheduleAtMs: getMealCardScheduleDate(card, context.now ?? new Date())?.getTime() ?? Number.MAX_SAFE_INTEGER,
  };
}

function getReciprocalScore(
  currentUser: User,
  card: MealCard,
  author: User | undefined,
  myInterestToCard: number,
  exchangeRequests: MealExchangeRequest[]
) {
  const targetPreferenceTags = normalizeTags([...(author?.preferenceTags ?? []), ...card.tags]);
  const currentSignals = normalizeTags([...currentUser.preferenceTags]);
  const targetLikelyAcceptMe =
    targetPreferenceTags.length && currentSignals.length ? jaccard(targetPreferenceTags, currentSignals) : 0.45;
  const relatedRequests = exchangeRequests.filter(
    (request) =>
      request.senderUserId === card.userId ||
      request.receiverUserId === card.userId ||
      request.targetCardId === card.id ||
      request.ownCardId === card.id
  );
  const priorAccepted = relatedRequests.some((request) => request.status === "accepted");
  const priorPending = relatedRequests.some((request) => request.status === "pending");
  const pairCore = Math.min(myInterestToCard || 0.35, targetLikelyAcceptMe || 0.35);

  return clamp01(pairCore * 0.75 + (priorAccepted ? 0.18 : 0) + (priorPending ? 0.07 : 0));
}

function getSceneScore(currentUser: User, card: MealCard, now: Date) {
  const currentTags = normalizeTags(currentUser.preferenceTags);
  const placeScore = getPlaceScore(currentTags, card);
  const timeScore = Math.max(getTimeScore(card.time, now), getMealCardScheduleScore(card, now));
  const peopleScore = getPeopleScore(card.people, currentTags);
  const availabilityScore = getFreshnessScore(card, now);

  return clamp01(timeScore * 0.42 + placeScore * 0.3 + peopleScore * 0.2 + availabilityScore * 0.08);
}

function getInterestScore(
  currentUser: User,
  card: MealCard,
  author: User | undefined,
  context: MealCardRecommendationContext
): InterestScoreResult {
  const legacyScore = getLegacyInterestScore(currentUser, card, author);
  const semantic = getSemanticScore(currentUser, card, context);
  const score = semantic.available ? clamp01(legacyScore * 0.72 + semantic.score * 0.28) : legacyScore;
  return {
    score,
    legacyScore,
    semanticScore: semantic.available ? semantic.score : 0,
    semanticReasons: semantic.reasons,
  };
}

function getLegacyInterestScore(currentUser: User, card: MealCard, author: User | undefined) {
  const userTags = normalizeTags(currentUser.preferenceTags);
  const cardTags = normalizeTags([...card.tags, card.place, card.people]);
  const authorTags = normalizeTags([...(author?.preferenceTags ?? []), author?.school ?? "", author?.bio ?? ""]);
  const tagOverlapScore = userTags.length && cardTags.length ? jaccard(userTags, cardTags) : 0.35;
  const textOverlapScore = getTextOverlapScore(userTags, [card.text, card.place, card.people, ...card.tags].join(" "));
  const profileOverlapScore = userTags.length && authorTags.length ? jaccard(userTags, authorTags) : 0.3;
  const communityTopicScore = Math.max(tagOverlapScore, textOverlapScore) * 0.7;

  return clamp01(tagOverlapScore * 0.5 + textOverlapScore * 0.2 + profileOverlapScore * 0.2 + communityTopicScore * 0.1);
}

function getSemanticScore(currentUser: User, card: MealCard, context: MealCardRecommendationContext) {
  const cached = context.recommendationCaches?.get(card.id);
  if (cached && (cached.semanticScore > 0 || cached.reasonTags.length)) {
    return {
      available: true,
      score: clamp01(cached.semanticScore),
      reasons: cached.reasonTags.slice(0, 2).map(labelForTag),
    };
  }

  const profileTags = readProfileTags(context.currentUserAiProfile);
  const authorProfileTags = readProfileTags(context.authorAiProfiles?.get(card.userId)).map((item) => ({ ...item, score: item.score * 0.42 }));
  const userTags = weightedUniqueTags([
    ...normalizeTags(currentUser.preferenceTags).map((tag) => ({ tag, score: 0.72 })),
    ...profileTags,
    ...currentUserMemoryItems(context).flatMap((memory) => memory.canonicalTags.map((tag) => ({ tag, score: memorySourceTagWeight(memory.sourceType) }))),
  ]);
  const cardMemory = findMemoryForMealCard(context.aiMemoryItems ?? [], card.id);
  const cardTags = weightedUniqueTags([
    ...extractCanonicalTags([card.text, card.time, card.place, card.people, ...card.tags].join(" ")).map((tag) => ({ tag, score: 0.72 })),
    ...normalizeTags([...card.tags, card.place, card.people]).map((tag) => ({ tag, score: 0.62 })),
    ...(cardMemory?.canonicalTags ?? []).map((tag) => ({ tag, score: 0.9 })),
    ...authorProfileTags,
  ]);

  if (!userTags.length || !cardTags.length) {
    return { available: false, score: 0, reasons: [] as string[] };
  }

  const sharedTags = userTags
    .filter((userTag) => !userTag.tag.startsWith("custom:") && cardTags.some((cardTag) => cardTag.tag === userTag.tag))
    .sort((left, right) => right.score - left.score);
  const canonicalScore = sharedTags.length
    ? clamp01(sharedTags.reduce((sum, tag) => sum + tag.score, 0) / Math.max(1.8, Math.min(userTags.length, cardTags.length)))
    : 0;
  const dimensionScore = getDimensionCompatibilityScore(userTags, cardTags);
  const vectorScore = getCachedVectorScore(currentUserMemoryItems(context), cardMemory);
  const semanticScore = clamp01(canonicalScore * 0.58 + dimensionScore * 0.27 + vectorScore * 0.15);
  const reasons = sharedTags.slice(0, 2).map((tag) => labelForTag(tag.tag));

  return {
    available: true,
    score: semanticScore,
    reasons,
  };
}

function readProfileTags(profile: UserAiProfile | undefined) {
  const rawProfile = profile?.profile;
  if (!rawProfile || typeof rawProfile !== "object" || Array.isArray(rawProfile)) return [];
  const topTags = Array.isArray(rawProfile.topTags) ? rawProfile.topTags : [];
  return topTags
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
      const record = item as Record<string, unknown>;
      const tag = typeof record.tag === "string" ? normalizeToCanonicalTag(record.tag) : undefined;
      if (!tag || tag.startsWith("custom:")) return undefined;
      const score = typeof record.score === "number" && Number.isFinite(record.score) ? record.score : 0.7;
      return { tag, score: clamp01(score) };
    })
    .filter((item): item is { tag: string; score: number } => Boolean(item));
}

function currentUserMemoryItems(context: MealCardRecommendationContext) {
  return (context.aiMemoryItems ?? []).filter((item) => item.userId === context.currentUser.id && item.status === "active");
}

function findMemoryForMealCard(items: AiMemoryItem[], cardId: string) {
  return items.find((item) => item.sourceType === "meal_card" && item.sourceId === cardId && item.status === "active");
}

function weightedUniqueTags(items: Array<{ tag: string; score: number }>) {
  const byTag = new Map<string, number>();
  for (const item of items) {
    const tag = normalizeToCanonicalTag(item.tag);
    if (!tag || tag.startsWith("custom:")) continue;
    byTag.set(tag, Math.max(byTag.get(tag) ?? 0, clamp01(item.score)));
  }
  return Array.from(byTag.entries()).map(([tag, score]) => ({ tag, score }));
}

function memorySourceTagWeight(sourceType: AiMemoryItem["sourceType"]) {
  if (sourceType === "profile_tag") return 0.9;
  if (sourceType === "meal_card") return 0.78;
  if (sourceType === "post") return 0.62;
  return 0.52;
}

function getDimensionCompatibilityScore(userTags: Array<{ tag: string; score: number }>, cardTags: Array<{ tag: string; score: number }>) {
  const userDimensions = new Map<string, number>();
  const cardDimensions = new Map<string, number>();
  for (const item of userTags) userDimensions.set(getTagDimension(item.tag), Math.max(userDimensions.get(getTagDimension(item.tag)) ?? 0, item.score));
  for (const item of cardTags) cardDimensions.set(getTagDimension(item.tag), Math.max(cardDimensions.get(getTagDimension(item.tag)) ?? 0, item.score));

  let score = 0;
  let totalWeight = 0;
  const weights: Record<string, number> = {
    food: 0.24,
    scene: 0.18,
    time: 0.14,
    social: 0.12,
    intent: 0.12,
    topic: 0.08,
    budget: 0.06,
    location: 0.06,
  };
  for (const [dimension, weight] of Object.entries(weights)) {
    totalWeight += weight;
    score += Math.min(userDimensions.get(dimension) ?? 0, cardDimensions.get(dimension) ?? 0) * weight;
  }
  return totalWeight ? clamp01(score / totalWeight) : 0;
}

function getCachedVectorScore(userMemories: AiMemoryItem[], cardMemory: AiMemoryItem | undefined) {
  if (!cardMemory?.embedding.length || !isRealEmbeddingModel(cardMemory.embeddingModel)) return 0;
  const sameModelMemories = userMemories.filter(
    (memory) => memory.embedding.length && memory.embeddingModel === cardMemory.embeddingModel && isRealEmbeddingModel(memory.embeddingModel)
  );
  if (!sameModelMemories.length) return 0;
  const best = Math.max(...sameModelMemories.map((memory) => cosineSimilarity(memory.embedding, cardMemory.embedding)));
  return clamp01((best + 1) / 2);
}

function isRealEmbeddingModel(model: string | undefined) {
  return Boolean(model && model !== "local-hash-embedding-v1");
}

function getBehaviorScore(currentUserId: string, card: MealCard, exchangeRequests: MealExchangeRequest[]) {
  const relatedRequests = exchangeRequests.filter(
    (request) =>
      request.targetCardId === card.id ||
      request.ownCardId === card.id ||
      request.senderUserId === card.userId ||
      request.receiverUserId === card.userId
  );
  if (!relatedRequests.length) return 0.45;

  let score = 0.45;
  for (const request of relatedRequests) {
    if (request.status === "accepted") score += 0.3;
    if (request.status === "pending") score += 0.08;
    if (request.status === "rejected") score -= request.senderUserId === currentUserId ? 0.18 : 0.1;
  }
  return clamp01(score);
}

function getTrustScore(author: User | undefined, card: MealCard, userReportCount: number) {
  let score = 0.45;
  if (card.verified || author?.verified) score += 0.22;
  if (author?.profileCompleted) score += 0.12;
  if (author?.avatarUrl || author?.avatarText) score += 0.08;
  if (author?.bio && author.bio.trim().length >= 8) score += 0.08;
  score -= Math.min(0.3, userReportCount * 0.08);
  return clamp01(score);
}

function getQualityScore(card: MealCard) {
  let score = 0.35;
  const textLength = card.text.trim().length;
  if (textLength >= 12) score += 0.18;
  if (textLength >= 28) score += 0.08;
  if (card.tags.length >= 2) score += 0.15;
  if (card.tags.length > 6) score -= 0.06;
  if (card.time && card.place && card.people) score += 0.14;
  if (card.mediaUrl && card.mediaType) score += 0.08;
  return clamp01(score);
}

function getFreshnessScore(card: MealCard, now: Date) {
  const createdAt = parseTime(card.createdAt);
  if (!createdAt) return 0.45;
  const ageHours = Math.max(0, now.getTime() - createdAt) / 36e5;
  if (ageHours <= 6) return 1;
  if (ageHours <= 24) return 0.86;
  if (ageHours <= 72) return 0.64;
  if (ageHours <= 168) return 0.42;
  return 0.25;
}

function getExplorationScore(card: MealCard) {
  const hash = stableHash(card.id);
  const lowStoredScoreBonus = card.matchScore < 75 ? 0.2 : 0;
  return clamp01(0.35 + (hash % 40) / 100 + lowStoredScoreBonus);
}

function getPenalty(currentUserId: string, card: MealCard, context: MealCardRecommendationContext) {
  let penalty = 0;
  penalty += Math.min(0.22, (context.cardReportCounts.get(card.id) ?? 0) * 0.08);
  penalty += Math.min(0.18, (context.userReportCounts.get(card.userId) ?? 0) * 0.06);

  const rejectedByCurrentUser = context.exchangeRequests.some(
    (request) =>
      request.status === "rejected" &&
      request.senderUserId === currentUserId &&
      (request.receiverUserId === card.userId || request.targetCardId === card.id)
  );
  if (rejectedByCurrentUser) penalty += 0.16;
  return penalty;
}

function buildReason(input: {
  currentUser: User;
  author: User | undefined;
  card: MealCard;
  interestScore: number;
  semanticScore: number;
  semanticReasons: string[];
  reciprocalScore: number;
  sceneScore: number;
  behaviorScore: number;
  trustScore: number;
  qualityScore: number;
  freshnessScore: number;
}) {
  const reasons: string[] = [];
  const sharedTags = normalizeTags(input.currentUser.preferenceTags).filter((tag) =>
    normalizeTags([...input.card.tags, input.card.place, input.card.people]).includes(tag)
  );

  if (input.semanticScore >= 0.58 && input.semanticReasons.length) {
    reasons.push(`公开语义线索里都出现过${input.semanticReasons.slice(0, 2).join("、")}`);
  }
  if (input.sceneScore >= 0.72) reasons.push("饭点、地点和人数偏好都比较接近");
  else if (getTimeScore(input.card.time, new Date()) >= 0.8) reasons.push("饭点很适合今天直接约");
  else if (sharedTags.length) reasons.push(`你们都提到了${sharedTags.slice(0, 2).map(labelForTag).join("、")}`);

  if (input.reciprocalScore >= 0.62) reasons.push("双方偏好有交集");
  if (input.behaviorScore >= 0.68) reasons.push("你们已有积极互动基础");
  if (input.trustScore >= 0.72) reasons.push("对方资料完整且可信度较高");
  if (input.qualityScore >= 0.72 && input.card.mediaUrl) reasons.push("卡片信息完整并附带媒体");
  if (input.freshnessScore >= 0.86) reasons.push("这是一张近期发布的新卡片");

  if (!reasons.length && input.interestScore >= 0.48) reasons.push("标签和文案与你的偏好有重合");
  if (!reasons.length) reasons.push(input.card.reason || "根据标签、饭点和地点综合推荐");

  return unique(reasons).slice(0, 2).join("，");
}

function getPlaceScore(userTags: string[], card: MealCard) {
  const place = normalizeToken(card.place);
  if (!place) return 0.35;
  if (userTags.some((tag) => place.includes(tag) || tag.includes(place))) return 1;
  if (card.tags.some((tag) => normalizeToken(tag) === place)) return 0.78;
  if (place.includes("附近") || place.includes("同校") || place.includes("食堂")) return 0.68;
  if (place.includes("随便") || place.includes("都可以")) return 0.58;
  return 0.45;
}

function getTimeScore(value: string, now: Date) {
  const normalized = normalizeToken(value);
  if (!normalized) return 0.35;
  if (normalized.includes("今天") || normalized.includes("今晚") || normalized.includes("中午")) return 0.92;
  if (normalized.includes("明天")) return 0.72;

  const hourMatch = normalized.match(/(\d{1,2}):?(\d{2})?/);
  if (hourMatch) {
    const hour = Number(hourMatch[1]);
    if (Number.isFinite(hour)) {
      const currentHour = now.getHours();
      const distance = Math.abs(hour - currentHour);
      if ((hour >= 11 && hour <= 13) || (hour >= 17 && hour <= 20)) return distance <= 5 ? 0.84 : 0.72;
      return distance <= 3 ? 0.62 : 0.48;
    }
  }

  return 0.5;
}

function getPeopleScore(value: string, userTags: string[]) {
  const normalized = normalizeToken(value);
  if (!normalized) return 0.45;
  if (normalized.includes("都可以") || normalized.includes("随便")) return 0.75;
  if (userTags.some((tag) => normalized.includes(tag) || tag.includes(normalized))) return 1;
  if (normalized.includes("1") || normalized.includes("一")) return 0.68;
  if (normalized.includes("2") || normalized.includes("3")) return 0.62;
  return 0.55;
}

function getTextOverlapScore(tags: string[], text: string) {
  const normalizedText = normalizeToken(text);
  const textCanonicalTags = extractCanonicalTags(text);
  if (!tags.length || !normalizedText) return 0.3;
  const hits = tags.filter((tag) => {
    const normalizedTag = normalizeToken(tag);
    return (
      textCanonicalTags.includes(tag) ||
      (normalizedTag && (normalizedText.includes(normalizedTag) || normalizedTag.includes(normalizedText)))
    );
  }).length;
  return clamp01(hits / Math.max(2, tags.length));
}

function jaccard(left: string[], right: string[]) {
  const leftSet = new Set(normalizeTags(left));
  const rightSet = new Set(normalizeTags(right));
  if (!leftSet.size || !rightSet.size) return 0;

  let intersection = 0;
  for (const item of leftSet) {
    if (rightSet.has(item)) intersection += 1;
  }
  return intersection / (leftSet.size + rightSet.size - intersection);
}

function normalizeTags(tags: Array<string | undefined>) {
  return normalizeSemanticTokens(tags);
}

function normalizeToken(value: string) {
  return normalizeToCanonicalTag(value);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function parseTime(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
