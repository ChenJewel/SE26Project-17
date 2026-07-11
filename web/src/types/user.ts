/**
 * 原型期的轻量用户摘要。
 *
 * 正式实现时应使用稳定 userId；当前为了快速验证跳转，仍以昵称 name 作为匹配键。
 */
export type UserSummary = {
  name: string;
  avatar: string;
  source?: string;
  verified?: boolean;
};
