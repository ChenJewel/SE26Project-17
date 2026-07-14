/**
 * 约饭卡原型 store。
 *
 * 约饭卡云端 store。
 *
 * 正式运行不再读取本地 seed/localStorage；接口失败时保持空列表，避免新用户看到假数据。
 */
import { useEffect, useState } from "react";
import { defaultTagOptions } from "@/data/meal";
import { subscribeRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { uniqueTrimmed } from "@/lib/collections";
import { createMealCard, deleteMealCard, fetchMealCards, updateMealCard } from "@/services/mealCardsApi";
import type { MealCard } from "@/types/meal";

export function useMealCards() {
  const [cards, setCards] = useState<MealCard[]>([]);
  const [tagOptions, setTagOptions] = useState<string[]>(() =>
    uniqueTrimmed(defaultTagOptions)
  );
  const [publishedCardId, setPublishedCardId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCards() {
      try {
        const response = await fetchMealCards();
        if (cancelled) return;

        const nextCards = response.cards;
        setCards(nextCards);
        setTagOptions((current) =>
          uniqueTrimmed([...current, ...defaultTagOptions, ...nextCards.flatMap((card) => card.tags)])
        );
      } catch (error) {
        console.warn("Failed to load meal cards from API.", error);
        if (!cancelled) setCards([]);
      }
    }

    loadCards();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeRealtimeEvents((event) => {
      if (event.type === "meal-card.created" && isMealCardEvent(event.data)) {
        const data = event.data;
        setCards((current) => [data.card, ...current.filter((card) => card.id !== data.card.id)]);
        return;
      }

      if (event.type === "meal-card.updated" && isMealCardEvent(event.data)) {
        const data = event.data;
        setCards((current) => {
          const exists = current.some((card) => card.id === data.card.id);
          if (!exists) return [data.card, ...current];
          return current.map((card) => (card.id === data.card.id ? data.card : card));
        });
        return;
      }

      if (event.type === "meal-card.deleted" && isMealCardDeletedEvent(event.data)) {
        const data = event.data;
        setCards((current) => current.filter((card) => card.id !== data.cardId));
      }
    });
  }, []);

  const publishCard = async (card: MealCard) => {
    const publishedCard = {
      ...card,
      createdAt: card.createdAt ?? new Date().toISOString(),
    };
    setTagOptions((current) => uniqueTrimmed([...current, ...card.tags]));

    const savedCard = await createMealCard(publishedCard);
    setCards((current) => [savedCard, ...current.filter((item) => item.id !== publishedCard.id)]);
    setPublishedCardId(savedCard.id);
    return savedCard;
  };

  const replaceTagOptions = (nextTags: string[]) => {
    setTagOptions(uniqueTrimmed(nextTags));
  };

  const updateCard = async (cardId: string, patch: Partial<MealCard>) => {
    const savedCard = await updateMealCard(cardId, patch);
    setCards((current) => current.map((card) => (card.id === cardId ? savedCard : card)));
    if (savedCard.tags?.length) {
      setTagOptions((current) => uniqueTrimmed([...current, ...savedCard.tags]));
    }
    return savedCard;
  };

  const removeCard = async (cardId: string) => {
    await deleteMealCard(cardId);
    setCards((current) => current.filter((card) => card.id !== cardId));
  };

  return {
    cards,
    tagOptions,
    publishedCardId,
    publishCard,
    updateCard,
    removeCard,
    replaceTagOptions,
  };
}

function isMealCardEvent(data: unknown): data is { card: MealCard } {
  return Boolean(data && typeof data === "object" && "card" in data && (data as { card?: { id?: unknown } }).card?.id);
}

function isMealCardDeletedEvent(data: unknown): data is { cardId: string } {
  return Boolean(data && typeof data === "object" && typeof (data as { cardId?: unknown }).cardId === "string");
}
