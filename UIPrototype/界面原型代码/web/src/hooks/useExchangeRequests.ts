/**
 * 交换约饭卡原型 store。
 *
 * `autoOpenRequestId` 和 `chatListResetSignal` 是导航意图，不是业务字段。
 * 正式版应使用路由参数，例如 `/messages/:conversationId?requestId=...`。
 */
import { useState } from "react";
import { createMealExchangeRequest } from "@/lib/exchange";
import type { MealExchangeRequest } from "@/types/exchange";
import type { MealCard } from "@/types/meal";

export function useExchangeRequests(cards: MealCard[], publishedCardId: string | null) {
  const [activeChatName, setActiveChatName] = useState("林同学");
  const [exchangeRequests, setExchangeRequests] = useState<MealExchangeRequest[]>([]);
  const [autoOpenRequestId, setAutoOpenRequestId] = useState<string | null>(null);
  const [chatListResetSignal, setChatListResetSignal] = useState(0);

  const createInvite = (card: MealCard) => {
    const request = createMealExchangeRequest({ targetCard: card, cards, publishedCardId });

    setExchangeRequests((current) => [request, ...current]);
    setAutoOpenRequestId(request.id);
    // TODO(user-id): 当前会话按昵称打开；正式版应由 targetUserId/conversationId 定位聊天。
    setActiveChatName(card.nickname);
  };

  const respondExchange = (requestId: string, status: "rejected" | "accepted") => {
    setExchangeRequests((current) =>
      current.map((request) => (request.id === requestId ? { ...request, status } : request))
    );
  };

  const resetChatListNavigation = () => {
    setAutoOpenRequestId(null);
    setChatListResetSignal((value) => value + 1);
  };

  return {
    activeChatName,
    exchangeRequests,
    autoOpenRequestId,
    chatListResetSignal,
    createInvite,
    respondExchange,
    resetChatListNavigation,
  };
}
