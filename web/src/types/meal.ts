/**
 * 约饭卡核心数据模型。
 *
 * 目前用于首页划卡、发卡片、搜索详情、我的页和交换卡片消息。
 * 后续接后端时建议把 userId 设为必填，并补充标准时间字段、地点 ID 和媒体头像资源。
 */
export interface MealCard {
  id: string;
  /** TODO: 正式版必须保存发卡人的 userId，不能用 nickname 匹配用户主页或聊天。 */
  userId?: string;
  nickname: string;
  avatarText: string;
  avatarUrl?: string;
  verified: boolean;
  text: string;
  time: string;
  place: string;
  people: string;
  tags: string[];
  matchScore: number;
  reason: string;
  /** 原型本地发布时间；正式版由后端生成 ISO 时间。 */
  mediaType?: "photo" | "video";
  mediaUrl?: string;
  mediaMimeType?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: "active" | "closed" | "deleted";
  editCount?: number;
}
