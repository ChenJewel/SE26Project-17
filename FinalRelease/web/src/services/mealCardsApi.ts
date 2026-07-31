/**
 * Meal card API boundary.
 *
 * Hooks can switch from local state to these functions once the Ubuntu backend
 * exposes `/meal-cards`. Keeping this boundary small prevents API calls from
 * leaking into presentation components.
 */
import { apiClient } from "@/services/apiClient";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import type { MealCard } from "@/types/meal";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

function mapMealCard(card: MealCard): MealCard {
  return {
    ...card,
    mediaUrl: card.mediaUrl ? resolveMediaUrl(card.mediaUrl) : undefined,
  };
}

export interface MealCardListResponse {
  cards: MealCard[];
}

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (
    response &&
    typeof response === "object" &&
    "success" in response &&
    "data" in response
  ) {
    return (response as ApiEnvelope<T>).data;
  }

  return response as T;
}

export async function fetchMealCards() {
  const response = await apiClient.get<ApiEnvelope<MealCardListResponse> | MealCardListResponse>("/meal-cards");
  const data = unwrapData(response);
  return { ...data, cards: data.cards.map(mapMealCard) };
}

export async function createMealCard(card: MealCard) {
  const response = await apiClient.post<ApiEnvelope<MealCard> | MealCard>("/meal-cards", card);
  return mapMealCard(unwrapData(response));
}

export async function updateMealCard(cardId: string, patch: Partial<MealCard>) {
  const response = await apiClient.patch<ApiEnvelope<{ card: MealCard }> | { card: MealCard }>(`/meal-cards/${cardId}`, patch);
  return mapMealCard(unwrapData(response).card);
}

export async function deleteMealCard(cardId: string) {
  await apiClient.delete<ApiEnvelope<{ deleted: boolean; cardId: string }> | { deleted: boolean; cardId: string }>(`/meal-cards/${cardId}`);
  return cardId;
}

export async function recordMealCardRecommendationEvent(input: {
  eventType: "detail_open" | "skip";
  cardId: string;
  rank?: number;
  matchScore?: number;
  reason?: string;
  source?: string;
  context?: Record<string, unknown>;
}) {
  await apiClient.post<ApiEnvelope<{ recorded: boolean }> | { recorded: boolean }>("/meal-cards/recommendation-events", input);
}
