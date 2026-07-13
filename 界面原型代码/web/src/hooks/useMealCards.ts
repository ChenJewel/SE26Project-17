/**
 * 约饭卡原型 store。
 *
 * 当前用本地 state 模拟 `/meal-cards` 和标签接口；正式接后端时，
 * 保留这个 hook 的对外字段，内部替换成 API/store 即可。
 */
import { useState } from "react";
import { defaultTagOptions, seedCards } from "@/data/meal";
import { uniqueTrimmed } from "@/lib/collections";
import type { MealCard } from "@/types/meal";

export function useMealCards() {
  const [cards, setCards] = useState<MealCard[]>(seedCards);
  const [tagOptions, setTagOptions] = useState<string[]>(() =>
    uniqueTrimmed([...defaultTagOptions, ...seedCards.flatMap((card) => card.tags)])
  );
  const [publishedCardId, setPublishedCardId] = useState<string | null>(null);

  const publishCard = (card: MealCard) => {
    setCards((current) => [card, ...current]);
    setTagOptions((current) => uniqueTrimmed([...current, ...card.tags]));
    setPublishedCardId(card.id);
  };

  const replaceTagOptions = (nextTags: string[]) => {
    setTagOptions(uniqueTrimmed(nextTags));
  };

  return {
    cards,
    tagOptions,
    publishedCardId,
    publishCard,
    replaceTagOptions,
  };
}
