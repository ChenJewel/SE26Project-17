/**
 * 认证与当前用户模型。
 *
 * 当前 Web 原型先用本地 state 模拟登录；正式版应由 `/auth/me` 返回 CurrentUser。
 */
export type AuthMode = "login" | "register";

export type CurrentUser = {
  id: string;
  email: string;
  nickname: string;
  schoolDomain: string;
  schoolName: string;
  campusVerified: boolean;
  role?: "user" | "admin";
  avatarText: string;
  avatarUrl?: string;
  bio?: string;
};

export type AuthDraft = {
  email: string;
  password: string;
  nickname: string;
};
