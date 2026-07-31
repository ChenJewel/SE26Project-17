import { postgresStore } from "../data/postgres.js";
import { makeId } from "../data/store.js";
import type { MealCard, MealCardRecommendationCache, MealCardRecommendationEventType } from "../types.js";

const maxExposureEventsPerRequest = readPositiveInteger(process.env.MEAL_CARD_RECOMMENDATION_EXPOSURE_LIMIT, 20);

export function recordMealCardRecommendationExposure(input: {
  userId: string;
  cards: MealCard[];
  recommendationCaches?: Map<string, MealCardRecommendationCache>;
  source?: string;
}) {
  const createdAt = new Date().toISOString();
  const events = input.cards.slice(0, maxExposureEventsPerRequest).map((card, index) => {
    const cache = input.recommendationCaches?.get(card.id);
    return {
      id: makeId("mealrec"),
      userId: input.userId,
      cardId: card.id,
      authorUserId: card.userId,
      eventType: "exposure" as const,
      rank: index + 1,
      matchScore: card.matchScore,
      reason: card.reason.slice(0, 240),
      source: input.source ?? "home",
      context: {
        cacheHit: Boolean(cache),
        cacheFeatureVersion: cache?.featureVersion,
        cacheUpdatedAt: cache?.updatedAt,
      },
      createdAt,
    };
  });

  void postgresStore.createMealCardRecommendationEvents(events).catch((error) => {
    console.warn("Failed to record meal card recommendation exposures.", error);
  });
}

export function recordMealCardRecommendationEvent(input: {
  userId: string;
  card?: MealCard;
  cardId?: string;
  authorUserId?: string;
  eventType: MealCardRecommendationEventType;
  rank?: number;
  matchScore?: number;
  reason?: string;
  source?: string;
  context?: Record<string, unknown>;
}) {
  void postgresStore
    .createMealCardRecommendationEvent({
      id: makeId("mealrec"),
      userId: input.userId,
      cardId: input.card?.id ?? input.cardId,
      authorUserId: input.card?.userId ?? input.authorUserId,
      eventType: input.eventType,
      rank: input.rank,
      matchScore: input.matchScore,
      reason: input.reason?.slice(0, 240),
      source: input.source ?? "home",
      context: input.context ?? {},
    })
    .catch((error) => {
      console.warn("Failed to record meal card recommendation event.", error);
    });
}

export function markAiSuggestionRecipientReply(input: {
  conversationId: string;
  replierUserId: string;
  repliedAt?: string;
}) {
  void postgresStore.markAiRecommendationRecipientReply(input).catch((error) => {
    console.warn("Failed to mark AI suggestion recipient reply.", error);
  });
}

export function markAiSuggestionAdvancedToMeal(input: {
  conversationId: string;
  requesterUserId: string;
  advancedAt?: string;
  outcome?: Record<string, unknown>;
}) {
  void postgresStore.markAiRecommendationAdvancedToMeal(input).catch((error) => {
    console.warn("Failed to mark AI suggestion advanced-to-meal outcome.", error);
  });
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
