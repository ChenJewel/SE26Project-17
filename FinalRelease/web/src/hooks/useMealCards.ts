/**
 * 约饭卡原型 store。
 *
 * 约饭卡云端 store。
 *
 * 正式运行不再读取本地 seed/localStorage；接口失败时保持空列表，避免新用户看到假数据。
 */
import { useCallback, useEffect, useState } from "react";
import { subscribeRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { uniqueTrimmed } from "@/lib/collections";
import { isMealCardVisibleOnHome } from "@/lib/mealCardVisibility";
import { createMealCard, deleteMealCard, fetchMealCards, updateMealCard } from "@/services/mealCardsApi";
import { defaultTagOptions } from "@/data/meal";
import type { MealCard } from "@/types/meal";

export function useMealCards() {
  const [cards, setCards] = useState<MealCard[]>([]);
  const [tagOptions, setTagOptions] = useState<string[]>(() => defaultTagOptions);
  const [publishedCardId, setPublishedCardId] = useState<string | null>(null);

  const refreshCards = useCallback(async () => {
    try {
      const response = await fetchMealCards();

      const nextCards = response.cards.filter((card) => (card.status ?? "active") === "active" && isMealCardVisibleOnHome(card));
      setCards(nextCards);
    } catch (error) {
      console.warn("Failed to load meal cards from API.", error);
      setCards([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    refreshCards().catch(() => {
      if (!cancelled) setCards([]);
    });

    return () => {
      cancelled = true;
    };
  }, [refreshCards]);

  useEffect(() => {
    return subscribeRealtimeEvents((event) => {
      if (event.type === "meal-card.created" && isMealCardEvent(event.data)) {
        const data = event.data;
        if ((data.card.status ?? "active") !== "active" || !isMealCardVisibleOnHome(data.card)) return;
        setCards((current) => [data.card, ...current.filter((card) => card.id !== data.card.id)]);
        return;
      }

      if (event.type === "meal-card.updated" && isMealCardEvent(event.data)) {
        const data = event.data;
        if ((data.card.status ?? "active") !== "active" || !isMealCardVisibleOnHome(data.card)) {
          setCards((current) => current.filter((card) => card.id !== data.card.id));
          return;
        }
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
        return;
      }

      if (event.type === "meal-card.cleanup" && isMealCardCleanupEvent(event.data)) {
        const cardIds = new Set(event.data.cardIds);
        setCards((current) => current.filter((card) => !cardIds.has(card.id)));
        return;
      }

      if (event.type === "user.profile.updated" && isUserProfileUpdatedEvent(event.data)) {
        const user = event.data.user;
        setCards((current) => current.map((card) => card.userId === user.id ? {
          ...card,
          nickname: user.nickname,
          avatarText: user.avatarText,
          avatarUrl: user.avatarUrl,
          verified: user.verified,
        } : card));
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
    setCards((current) => {
      const withoutDraft = current.filter((item) => item.id !== publishedCard.id);
      if ((savedCard.status ?? "active") !== "active" || !isMealCardVisibleOnHome(savedCard)) return withoutDraft;
      return [savedCard, ...withoutDraft];
    });
    setPublishedCardId(savedCard.id);
    return savedCard;
  };

  const replaceTagOptions = (nextTags: string[]) => {
    setTagOptions(uniqueTrimmed(nextTags));
  };

  const updateCard = async (cardId: string, patch: Partial<MealCard>) => {
    let previousCard: MealCard | undefined;
    setCards((current) =>
      current.map((card) => {
        if (card.id !== cardId) return card;
        previousCard = card;
        return { ...card, ...patch, updatedAt: new Date().toISOString() };
      })
    );

    try {
      const savedCard = await updateMealCard(cardId, patch);
      setCards((current) => {
        if ((savedCard.status ?? "active") !== "active" || !isMealCardVisibleOnHome(savedCard)) {
          return current.filter((card) => card.id !== cardId);
        }
        const exists = current.some((card) => card.id === cardId);
        if (!exists) return [savedCard, ...current];
        return current.map((card) => (card.id === cardId ? savedCard : card));
      });
      if (savedCard.tags?.length) {
        setTagOptions((current) => uniqueTrimmed([...current, ...savedCard.tags]));
      }
      return savedCard;
    } catch (error) {
      if (previousCard) {
        setCards((current) => current.map((card) => (card.id === cardId ? previousCard! : card)));
      }
      throw error;
    }
  };

  const removeCard = async (cardId: string) => {
    let removedCard: MealCard | undefined;
    setCards((current) => {
      removedCard = current.find((card) => card.id === cardId);
      return current.filter((card) => card.id !== cardId);
    });

    try {
      await deleteMealCard(cardId);
    } catch (error) {
      if (removedCard) {
        setCards((current) => [removedCard!, ...current.filter((card) => card.id !== cardId)]);
      }
      throw error;
    }
  };

  return {
    cards,
    tagOptions,
    publishedCardId,
    publishCard,
    updateCard,
    removeCard,
    replaceTagOptions,
    refreshCards,
  };
}

function isMealCardEvent(data: unknown): data is { card: MealCard } {
  return Boolean(data && typeof data === "object" && "card" in data && (data as { card?: { id?: unknown } }).card?.id);
}

function isMealCardDeletedEvent(data: unknown): data is { cardId: string } {
  return Boolean(data && typeof data === "object" && typeof (data as { cardId?: unknown }).cardId === "string");
}

function isMealCardCleanupEvent(data: unknown): data is { cardIds: string[] } {
  return Boolean(
    data &&
      typeof data === "object" &&
      Array.isArray((data as { cardIds?: unknown }).cardIds) &&
      (data as { cardIds: unknown[] }).cardIds.every((cardId) => typeof cardId === "string")
  );
}

function isUserProfileUpdatedEvent(data: unknown): data is { user: { id: string; nickname: string; avatarText: string; avatarUrl?: string; verified: boolean } } {
  if (!data || typeof data !== "object") return false;
  const user = (data as { user?: unknown }).user;
  return Boolean(
    user &&
    typeof user === "object" &&
    typeof (user as { id?: unknown }).id === "string" &&
    typeof (user as { nickname?: unknown }).nickname === "string" &&
    typeof (user as { avatarText?: unknown }).avatarText === "string"
  );
}
