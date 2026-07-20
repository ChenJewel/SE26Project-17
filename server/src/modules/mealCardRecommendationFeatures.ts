import { createHash } from "node:crypto";
import { filterHomeVisibleMealCards } from "../common/mealCardVisibility.js";
import { postgresStore } from "../data/postgres.js";
import type { AiMemoryItem, MealCard, MealCardRecommendationFeature, User, UserAiProfile } from "../types.js";
import { readEmbeddingConfig } from "./embeddingProvider.js";
import {
  buildCanonicalTags,
  cosineSimilarity,
  getTagDimension,
  labelForTag,
  normalizeSemanticTokens,
  normalizeToCanonicalTag,
} from "./semanticSignals.js";

export const mealCardRecommendationFeatureVersion = "meal-card-semantic-feature-v1";
export const mealCardRecommendationCacheVersion = "meal-card-recommendation-cache-v1";

interface WeightedTag {
  tag: string;
  score: number;
}

interface MealCardFeaturePayload {
  version: string;
  canonicalTags: string[];
  labels: string[];
  dimensions: Record<string, number>;
  textPreview: string;
  source: {
    time: string;
    place: string;
    people: string;
    tags: string[];
  };
}

const userRefreshTimers = new Map<string, NodeJS.Timeout>();
const pendingCardIdsByUser = new Map<string, Set<string>>();
const cacheTtlMs = readPositiveInteger(process.env.MEAL_CARD_RECOMMENDATION_CACHE_TTL_MS, 6 * 60 * 60 * 1000);

export function queueMealCardRecommendationFeatureRefresh(cardId: string) {
  setTimeout(() => {
    refreshMealCardRecommendationFeature(cardId).catch((error) => {
      console.warn("Failed to refresh meal card recommendation feature.", error);
    });
  }, 0);
}

export function queueUserMealCardRecommendationCacheRefresh(userId: string, cardIds?: string[]) {
  const pending = pendingCardIdsByUser.get(userId) ?? new Set<string>();
  for (const cardId of cardIds ?? []) pending.add(cardId);
  pendingCardIdsByUser.set(userId, pending);

  const existingTimer = userRefreshTimers.get(userId);
  if (existingTimer) return;

  const timer = setTimeout(() => {
    userRefreshTimers.delete(userId);
    const queuedCardIds = Array.from(pendingCardIdsByUser.get(userId) ?? []);
    pendingCardIdsByUser.delete(userId);
    refreshUserMealCardRecommendationCache(userId, queuedCardIds).catch((error) => {
      console.warn("Failed to refresh user meal card recommendation cache.", error);
    });
  }, 500);
  userRefreshTimers.set(userId, timer);
}

export async function refreshMealCardRecommendationFeature(cardId: string) {
  const card = await postgresStore.findMealCard(cardId);
  if (!card || card.status !== "active") {
    await postgresStore.markMealCardRecommendationFeatureStatus(cardId, "deleted");
    await postgresStore.deleteMealCardRecommendationCacheForCard(cardId);
    return { cardId, status: "deleted" as const };
  }

  const feature = buildMealCardFeaturePayload(card);
  const textHash = hashText(mealCardSemanticText(card));
  const embeddingModel = readEmbeddingConfig().modelVersion;
  const saved = await postgresStore.upsertMealCardRecommendationFeature({
    cardId,
    feature: feature as unknown as Record<string, unknown>,
    textHash,
    modelVersion: mealCardRecommendationFeatureVersion,
    embeddingModel,
    status: "active",
  });
  return { cardId, status: saved.status };
}

export async function refreshUserMealCardRecommendationCache(userId: string, cardIds?: string[]) {
  const user = await postgresStore.findUserById(userId);
  if (!user) return { userId, scanned: 0, updated: 0, missingFeatures: 0 };

  const now = new Date();
  const requestedCardIds = new Set(cardIds ?? []);
  const activeCards = filterHomeVisibleMealCards(await postgresStore.listActiveMealCards(), now).filter(
    (card) => !requestedCardIds.size || requestedCardIds.has(card.id)
  );
  if (!activeCards.length) return { userId, scanned: 0, updated: 0, missingFeatures: 0 };

  const cardIdsToScore = activeCards.map((card) => card.id);
  let features = await postgresStore.listMealCardRecommendationFeatures(cardIdsToScore);
  const featureByCardId = new Map(features.map((feature) => [feature.cardId, feature]));
  const missingCards = activeCards.filter((card) => !featureByCardId.has(card.id));

  for (const card of missingCards.slice(0, 80)) {
    await refreshMealCardRecommendationFeature(card.id);
  }

  if (missingCards.length) {
    features = await postgresStore.listMealCardRecommendationFeatures(cardIdsToScore);
  }

  const [profile, userMemories, cardMemories] = await Promise.all([
    postgresStore.getUserAiProfile(user.id),
    postgresStore.listAiMemoryItemsForUsers([user.id], 120),
    postgresStore.listAiMemoryItemsForMealCards(cardIdsToScore, Math.max(180, Math.min(600, cardIdsToScore.length))),
  ]);
  const userSignals = buildUserSemanticSignals(user, profile, userMemories);
  const cardMemoryByCardId = new Map(cardMemories.map((memory) => [memory.sourceId, memory]));
  const expiresAt = new Date(Date.now() + cacheTtlMs).toISOString();
  let updated = 0;

  for (const feature of features) {
    const score = scoreMealCardFeatureForUser(userSignals, feature, userMemories, cardMemoryByCardId.get(feature.cardId));
    await postgresStore.upsertMealCardRecommendationCache({
      userId: user.id,
      cardId: feature.cardId,
      semanticScore: score.score,
      reasonTags: score.reasonTags,
      featureVersion: mealCardRecommendationCacheVersion,
      sourceHash: hashText([user.updatedAt, profile.updatedAt, feature.textHash, score.sourceHash].join("|")),
      expiresAt,
    });
    updated += 1;
  }

  return { userId, scanned: activeCards.length, updated, missingFeatures: missingCards.length };
}

export async function backfillMealCardRecommendationFeatures(limit = 200) {
  const now = new Date();
  const cards = filterHomeVisibleMealCards(await postgresStore.listActiveMealCards(), now).slice(0, Math.max(1, limit));
  let updated = 0;
  for (const card of cards) {
    await refreshMealCardRecommendationFeature(card.id);
    updated += 1;
  }
  return { scanned: cards.length, updated };
}

export async function backfillMealCardRecommendationCaches(limitUsers = 100, limitCards = 200) {
  const users = await postgresStore.listUsers(limitUsers);
  const cards = filterHomeVisibleMealCards(await postgresStore.listActiveMealCards(), new Date()).slice(0, Math.max(1, limitCards));
  let updated = 0;
  for (const user of users) {
    const result = await refreshUserMealCardRecommendationCache(user.id, cards.map((card) => card.id));
    updated += result.updated;
  }
  return { users: users.length, cards: cards.length, updated };
}

function buildMealCardFeaturePayload(card: MealCard): MealCardFeaturePayload {
  const canonicalTags = weightedUniqueTags(
    buildCanonicalTags({ text: mealCardSemanticText(card), rawTags: card.tags })
      .filter((tag) => !tag.startsWith("custom:"))
      .map((tag) => ({ tag, score: 0.86 }))
  );
  return {
    version: mealCardRecommendationFeatureVersion,
    canonicalTags: canonicalTags.map((item) => item.tag),
    labels: canonicalTags.map((item) => labelForTag(item.tag)),
    dimensions: dimensionWeights(canonicalTags),
    textPreview: clipText(mealCardSemanticText(card), 120),
    source: {
      time: card.time,
      place: card.place,
      people: card.people,
      tags: card.tags,
    },
  };
}

function buildUserSemanticSignals(user: User, profile: UserAiProfile, memories: AiMemoryItem[]) {
  return weightedUniqueTags([
    ...normalizeSemanticTokens(user.preferenceTags).map((tag) => ({ tag, score: 0.72 })),
    ...readProfileTags(profile),
    ...memories.flatMap((memory) => memory.canonicalTags.map((tag) => ({ tag, score: memorySourceTagWeight(memory.sourceType) }))),
  ]);
}

function scoreMealCardFeatureForUser(
  userTags: WeightedTag[],
  feature: MealCardRecommendationFeature,
  userMemories: AiMemoryItem[],
  cardMemory: AiMemoryItem | undefined
) {
  const cardTags = weightedUniqueTags(readFeatureCanonicalTags(feature).map((tag) => ({ tag, score: 0.9 })));
  if (!userTags.length || !cardTags.length) {
    return { score: 0, reasonTags: [] as string[], sourceHash: "empty" };
  }

  const sharedTags = userTags
    .filter((userTag) => cardTags.some((cardTag) => cardTag.tag === userTag.tag))
    .sort((left, right) => right.score - left.score);
  const canonicalScore = sharedTags.length
    ? clamp01(sharedTags.reduce((sum, tag) => sum + tag.score, 0) / Math.max(1.8, Math.min(userTags.length, cardTags.length)))
    : 0;
  const dimensionScore = getDimensionCompatibilityScore(userTags, cardTags);
  const vectorScore = getCachedVectorScore(userMemories, cardMemory);
  const score = clamp01(canonicalScore * 0.58 + dimensionScore * 0.27 + vectorScore * 0.15);
  const sourceHash = hashText([
    userTags.map((item) => `${item.tag}:${item.score}`).join(","),
    cardTags.map((item) => `${item.tag}:${item.score}`).join(","),
    cardMemory?.embeddingModel ?? "",
    cardMemory?.embeddedAt ?? "",
  ].join("|"));

  return {
    score,
    reasonTags: sharedTags.slice(0, 2).map((tag) => tag.tag),
    sourceHash,
  };
}

function readFeatureCanonicalTags(feature: MealCardRecommendationFeature) {
  const tags = feature.feature.canonicalTags;
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag): tag is string => typeof tag === "string" && !tag.startsWith("custom:"));
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
    .filter((item): item is WeightedTag => Boolean(item));
}

function weightedUniqueTags(items: WeightedTag[]) {
  const byTag = new Map<string, number>();
  for (const item of items) {
    const tag = normalizeToCanonicalTag(item.tag);
    if (!tag || tag.startsWith("custom:")) continue;
    byTag.set(tag, Math.max(byTag.get(tag) ?? 0, clamp01(item.score)));
  }
  return Array.from(byTag.entries()).map(([tag, score]) => ({ tag, score }));
}

function dimensionWeights(tags: WeightedTag[]) {
  const dimensions: Record<string, number> = {};
  for (const tag of tags) {
    const dimension = getTagDimension(tag.tag);
    if (dimension === "custom") continue;
    dimensions[dimension] = Math.max(dimensions[dimension] ?? 0, tag.score);
  }
  return dimensions;
}

function getDimensionCompatibilityScore(userTags: WeightedTag[], cardTags: WeightedTag[]) {
  const userDimensions = dimensionWeights(userTags);
  const cardDimensions = dimensionWeights(cardTags);
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
    score += Math.min(userDimensions[dimension] ?? 0, cardDimensions[dimension] ?? 0) * weight;
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

function memorySourceTagWeight(sourceType: AiMemoryItem["sourceType"]) {
  if (sourceType === "profile_tag") return 0.9;
  if (sourceType === "meal_card") return 0.78;
  if (sourceType === "post") return 0.62;
  return 0.52;
}

function isRealEmbeddingModel(model: string | undefined) {
  return Boolean(model && model !== "local-hash-embedding-v1");
}

function mealCardSemanticText(card: MealCard) {
  return [card.text, card.time, card.place, card.people, ...card.tags].filter(Boolean).join(" ");
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex").slice(0, 24);
}

function clipText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
