/**
 * 原型期的轻量用户摘要。
 *
 * 正式实现时应使用稳定 userId；当前为了快速验证跳转，仍以昵称 name 作为匹配键。
 */
export type UserSummary = {
  /** TODO: 正式版使用 userId 作为唯一键；name 只用于展示。 */
  userId?: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  source?: string;
  verified?: boolean;
  bio?: string;
  school?: string;
  followerCount?: number;
  followingCount?: number;
  relation?: "none" | "following" | "followed-by" | "mutual";
};
