import type { MealCard } from "@/pages/CreateCard";

/**
 * 交换约饭卡请求。
 *
 * 原型里请求保存在 App state，聊天页按 targetName 过滤展示。
 * 正式实现时应由后端生成 requestId，并通过会话消息或实时事件推送给双方。
 */
export type MealExchangeRequest = {
  id: string;
  targetName: string;
  targetCard: MealCard;
  ownCard: MealCard;
  status: "pending" | "rejected" | "accepted";
};
