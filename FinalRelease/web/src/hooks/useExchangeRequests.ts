/**
 * 交换约饭卡导航状态。
 *
 * `autoOpenRequestId` 和 `chatListResetSignal` 是导航意图，不是业务字段。
 */
import { useState } from "react";
import { createMealInvite, updateExchangeRequestStatus } from "@/services/chatApi";
import type { MealExchangeRequest } from "@/types/exchange";
import type { MealCard } from "@/types/meal";

export function useExchangeRequests(cards: MealCard[], publishedCardId: string | null) {
  const [activeChatName, setActiveChatName] = useState("");
  const [exchangeRequests, setExchangeRequests] = useState<MealExchangeRequest[]>([]);
  const [autoOpenRequestId, setAutoOpenRequestId] = useState<string | null>(null);
  const [chatListResetSignal, setChatListResetSignal] = useState(0);

  const createInvite = async (card: MealCard) => {
    try {
      const response = await createMealInvite(card.id);
      const ownCard = cards.find((item) => item.id === publishedCardId);
      const request: MealExchangeRequest = {
        id: response.request.id,
        senderUserId: response.request.senderUserId,
        receiverUserId: response.request.receiverUserId,
        conversationId: response.conversation.id,
        targetName: response.conversation.title || card.nickname,
        targetCard: card,
        ownCard,
        status: response.request.status,
      };

      setExchangeRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
      setAutoOpenRequestId(request.id);
      setActiveChatName(request.targetName);
    } catch (error) {
      console.warn("Create meal invite failed.", error);
    }
  };

  const respondExchange = (requestId: string, status: "rejected" | "accepted") => {
    setExchangeRequests((current) =>
      current.map((request) => (request.id === requestId ? { ...request, status } : request))
    );
    updateExchangeRequestStatus(requestId, status).catch((error) => {
      console.warn("Update meal invite failed.", error);
    });
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
