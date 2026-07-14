/**
 * 认证状态 store。
 *
 * 当前接入云端 Auth API；后端仍是演示级 token=userId，
 * 后续生产化时需要升级为 JWT 或 Cookie session。
 */
import { useEffect, useMemo, useState } from "react";
import { fetchCurrentUser, loginWithEmail, logoutFromApi, registerWithEmail } from "@/services/authApi";
import { updateMyProfile } from "@/services/userApi";
import type { AuthDraft, CurrentUser } from "@/types/auth";

export function useAuthState() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authNotice, setAuthNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((user) => {
        if (!cancelled && user) {
          setCurrentUser(user);
          setAuthNotice(user.campusVerified ? "已恢复登录状态。" : "已恢复登录状态，校园认证待完善。");
        }
      })
      .catch(() => {
        if (!cancelled) setAuthNotice("");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isAuthenticated = Boolean(currentUser);
  const authSummary = useMemo(() => {
    if (!currentUser) return "未登录";
    return currentUser.campusVerified ? `${currentUser.schoolName} · 已认证` : "邮箱已登录 · 待校园认证";
  }, [currentUser]);

  const login = async ({ email, password }: AuthDraft) => {
    if (!email.includes("@") || password.length < 6) {
      setAuthNotice("请输入有效邮箱和至少 6 位密码。");
      return false;
    }

    try {
      const user = await loginWithEmail({ email, password, nickname: "" });
      setCurrentUser(user);
      setAuthNotice(user.campusVerified ? "登录成功，已识别校园邮箱。" : "登录成功，校园认证待完善。");
      return true;
    } catch {
      setAuthNotice("登录失败：邮箱或密码不正确。请先注册，或检查密码。");
      return false;
    }
  };

  const register = async ({ email, password, nickname }: AuthDraft) => {
    if (!email.includes("@") || password.length < 6 || nickname.trim().length < 1) {
      setAuthNotice("请填写昵称、有效邮箱和至少 6 位密码。");
      return false;
    }

    try {
      const user = await registerWithEmail({ email, password, nickname });
      setCurrentUser(user);
      setAuthNotice(user.campusVerified ? "注册成功，已通过邮箱后缀识别学校。" : "注册成功，后续可补充校园认证。");
      return true;
    } catch {
      setAuthNotice("注册失败：该邮箱可能已经注册，或服务器暂时不可用。");
      return false;
    }
  };

  const logout = async () => {
    await logoutFromApi();
    setCurrentUser(null);
    setAuthNotice("已退出登录。");
  };

  const updateProfile = async (input: {
    avatarText?: string;
    avatarUrl?: string;
    preferenceTags?: string[];
    nickname?: string;
    school?: string;
    bio?: string;
  }) => {
    const user = await updateMyProfile(input);
    setCurrentUser(user);
    return user;
  };

  return {
    currentUser,
    isAuthenticated,
    authNotice,
    authSummary,
    login,
    register,
    logout,
    updateProfile,
  };
}
