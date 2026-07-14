import type { MealExchangeRequest } from "@/types/exchange";
import type { MealCard } from "@/types/meal";

/**
 * 创建交换约饭卡请求。
 *
 * 原型规则：
 * 1. 优先发送用户最近发布的约饭卡。
 * 2. 如果还没发布，则尝试复用 cards 中昵称为“我”的卡片。
 * 3. 如果仍没有，则生成一张兜底卡片，保证交互可继续演示。
 *
 * 正式后端接入时，这里应替换为 createExchangeRequest API 调用。
 */
export function createMealExchangeRequest({
  targetCard,
  cards,
  publishedCardId,
}: {
  targetCard: MealCard;
  cards: MealCard[];
  publishedCardId: string | null;
}): MealExchangeRequest {
  const requestId = `exchange-${Date.now()}`;
  const ownCard =
    cards.find((item) => item.id === publishedCardId) ??
    cards.find((item) => item.nickname === "我") ??
    createFallbackOwnCard(targetCard);

  return {
    id: requestId,
    targetName: targetCard.nickname,
    targetCard,
    ownCard,
    status: "pending",
  };
}

function createFallbackOwnCard(targetCard: MealCard): MealCard {
  return {
    id: `auto-own-${Date.now()}`,
    nickname: "我",
    avatarText: "我",
    verified: true,
    text: "你好，我也想一起吃饭。可以先聊聊时间、地点和口味偏好。",
    time: targetCard.time,
    place: targetCard.place,
    people: targetCard.people,
    tags: ["约饭", targetCard.place, targetCard.time],
    matchScore: 88,
    reason: "由系统自动生成用于交换卡片",
  };
}
