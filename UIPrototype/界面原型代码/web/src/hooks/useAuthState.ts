/**
 * 本地认证原型 store。
 *
 * MVP 接后端时，把 `login/register/logout` 内部替换为 Auth API：
 * - POST /auth/login
 * - POST /auth/register
 * - POST /auth/logout
 * - GET /auth/me
 */
import { useMemo, useState } from "react";
import type { AuthDraft, CurrentUser } from "@/types/auth";

const schoolDomainMap: Record<string, string> = {
  "fudan.edu.cn": "复旦大学",
  "sjtu.edu.cn": "上海交通大学",
  "tongji.edu.cn": "同济大学",
  "nyu.edu": "NYU",
  "edu.cn": "校园邮箱",
  "edu": "校园邮箱",
};

function resolveSchool(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const matched = Object.entries(schoolDomainMap).find(([suffix]) => domain.endsWith(suffix));
  return {
    schoolDomain: domain,
    schoolName: matched?.[1] ?? "待认证学校",
    campusVerified: Boolean(matched),
  };
}

export function useAuthState() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authNotice, setAuthNotice] = useState("");

  const isAuthenticated = Boolean(currentUser);
  const authSummary = useMemo(() => {
    if (!currentUser) return "未登录";
    return currentUser.campusVerified ? `${currentUser.schoolName} · 已认证` : "邮箱已登录 · 待校园认证";
  }, [currentUser]);

  const login = ({ email, password }: AuthDraft) => {
    if (!email.includes("@") || password.length < 6) {
      setAuthNotice("请输入有效邮箱和至少 6 位密码。");
      return false;
    }

    const school = resolveSchool(email);
    setCurrentUser({
      id: `user-${email.toLowerCase()}`,
      email,
      nickname: email.split("@")[0] || "ueat 用户",
      avatarText: (email[0] || "U").toUpperCase(),
      ...school,
    });
    setAuthNotice(school.campusVerified ? "登录成功，已识别校园邮箱。" : "登录成功，校园认证待完善。");
    return true;
  };

  const register = ({ email, password, nickname }: AuthDraft) => {
    if (!email.includes("@") || password.length < 6 || nickname.trim().length < 1) {
      setAuthNotice("请填写昵称、有效邮箱和至少 6 位密码。");
      return false;
    }

    const school = resolveSchool(email);
    setCurrentUser({
      id: `user-${email.toLowerCase()}`,
      email,
      nickname: nickname.trim(),
      avatarText: nickname.trim().slice(0, 1).toUpperCase(),
      ...school,
    });
    setAuthNotice(school.campusVerified ? "注册成功，已通过邮箱后缀识别学校。" : "注册成功，后续可补充校园认证。");
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    setAuthNotice("已退出登录。");
  };

  return {
    currentUser,
    isAuthenticated,
    authNotice,
    authSummary,
    login,
    register,
    logout,
  };
}
