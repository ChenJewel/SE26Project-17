import type { MealCard } from "@/types/meal";

/**
 * 交换约饭卡请求。
 *
 * 交换约饭卡请求由云端生成，前端只保留本次导航所需的轻量展示状态。
 */
export type MealExchangeRequest = {
  id: string;
  senderUserId?: string;
  receiverUserId?: string;
  targetName: string;
  conversationId?: string;
  targetCard: MealCard;
  ownCard?: MealCard;
  status: "pending" | "rejected" | "accepted";
};
