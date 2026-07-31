/**
 * Auth state store.
 *
 * 当前接入云端 Auth API；后端仍是演示级 token=userId，
 * 后续生产化时需要升级为 JWT 或 Cookie session。
 */
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/services/apiClient";
import { subscribeRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { clearStoredAuthToken, fetchCurrentUser, loginWithEmail, logoutFromApi, registerWithEmail } from "@/services/authApi";
import { deleteMyAccount, updateMyProfile } from "@/services/userApi";
import type { AuthDraft, CurrentUser } from "@/types/auth";

const accountDeletionLocalKeys = ["ueat-settings-v2", "ueat-search-history", "ueat-card-draft", "ueat-post-draft", "ueat-last-open-tab"];

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

  useEffect(() => {
    if (!currentUser?.id) return;
    return subscribeRealtimeEvents((event) => {
      if (event.type !== "user.profile.updated" || !isUserProfileUpdatedEvent(event.data)) return;
      const user = event.data.user;
      if (user.id !== currentUser.id) return;
      setCurrentUser((current) => current ? {
        ...current,
        nickname: user.nickname,
        avatarText: user.avatarText,
        avatarUrl: user.avatarUrl,
        campusVerified: user.verified,
        role: user.role ?? current.role,
        schoolName: user.school ?? current.schoolName,
        bio: user.bio,
        preferenceTags: user.preferenceTags ?? current.preferenceTags,
      } : current);
    });
  }, [currentUser?.id]);

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
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthNotice("登录失败：邮箱或密码不正确。新用户请先切换到注册。");
      } else {
        setAuthNotice("登录失败：服务器暂时不可用，请稍后再试。");
      }
      return false;
    }
  };

  const register = async ({ email, password, nickname, mbti, emailCode, inviteCode }: AuthDraft) => {
    if (!email.includes("@") || password.length < 6 || nickname.trim().length < 1 || (!emailCode?.trim() && !inviteCode?.trim())) {
      setAuthNotice("请填写昵称、校园邮箱、验证码或邀请码，以及至少 6 位密码。");
      return false;
    }

    try {
      const user = await registerWithEmail({ email, password, nickname, mbti, emailCode, inviteCode });
      setCurrentUser(user);
      setAuthNotice("注册成功，校园身份已认证。");
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setAuthNotice("注册失败：这个邮箱已经注册过了，请直接登录。");
      } else if (error instanceof ApiError && error.status === 400) {
        setAuthNotice(readApiMessage(error) || "注册失败：请使用校园邮箱并填写正确验证码。");
      } else {
        setAuthNotice("注册失败：服务器暂时不可用，请稍后再试。");
      }
      return false;
    }
  };
  const logout = async () => {
    await logoutFromApi();
    setCurrentUser(null);
    setAuthNotice("已退出登录。");
  };

  const deleteAccount = async () => {
    const userId = currentUser?.id;
    await deleteMyAccount();
    if (typeof window !== "undefined") {
      accountDeletionLocalKeys.forEach((key) => window.localStorage.removeItem(key));
      if (userId) {
        window.localStorage.removeItem(`ueat-pet-companion-v2:${userId}`);
      }
      window.sessionStorage.clear();
    }
    clearStoredAuthToken();
    setCurrentUser(null);
    setAuthNotice("账号已注销，云端数据已删除。");
  };

  const updateProfile = async (input: {
    avatarText?: string;
    avatarUrl?: string;
    preferenceTags?: string[];
    nickname?: string;
    school?: string;
    bio?: string;
    profileCompleted?: boolean;
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
    deleteAccount,
    updateProfile,
  };
}

function isUserProfileUpdatedEvent(data: unknown): data is { user: { id: string; nickname: string; avatarText: string; avatarUrl?: string; verified: boolean; role?: "user" | "admin"; school?: string; bio?: string; preferenceTags?: string[] } } {
  if (!data || typeof data !== "object") return false;
  const user = (data as { user?: unknown }).user;
  return Boolean(
    user &&
      typeof user === "object" &&
      typeof (user as { id?: unknown }).id === "string" &&
      typeof (user as { nickname?: unknown }).nickname === "string" &&
      typeof (user as { avatarText?: unknown }).avatarText === "string"
  );
}

function readApiMessage(error: ApiError) {
  const payload = error.payload as { error?: { message?: unknown } } | undefined;
  return typeof payload?.error?.message === "string" ? payload.error.message : "";
}
