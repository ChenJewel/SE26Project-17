import { apiClient } from "@/services/apiClient";
import type { AuthDraft, CurrentUser } from "@/types/auth";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface PublicUser {
  id: string;
  email: string;
  nickname: string;
  avatarText: string;
  avatarUrl?: string;
  verified: boolean;
  school?: string;
  bio?: string;
}

interface AuthResponse {
  user: PublicUser;
  token: string;
}

const authTokenKey = "ueat-auth-token";

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (response && typeof response === "object" && "success" in response && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }
  return response as T;
}

function toCurrentUser(user: PublicUser): CurrentUser {
  const schoolDomain = user.email.split("@")[1]?.toLowerCase() ?? "";
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatarText: user.avatarText,
    avatarUrl: user.avatarUrl,
    schoolDomain,
    schoolName: user.school ?? (user.verified ? "校园邮箱" : "待认证学校"),
    campusVerified: user.verified,
    bio: user.bio,
  };
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function getStoredAuthToken() {
  return window.localStorage.getItem(authTokenKey);
}

export function storeAuthToken(token: string) {
  window.localStorage.setItem(authTokenKey, token);
}

export function clearStoredAuthToken() {
  window.localStorage.removeItem(authTokenKey);
}

export async function loginWithEmail(input: AuthDraft) {
  const response = await apiClient.post<ApiEnvelope<AuthResponse> | AuthResponse>("/auth/login", {
    email: input.email,
    password: input.password,
  });
  const data = unwrapData(response);
  storeAuthToken(data.token);
  return toCurrentUser(data.user);
}

export async function registerWithEmail(input: AuthDraft) {
  const response = await apiClient.post<ApiEnvelope<AuthResponse> | AuthResponse>("/auth/register", {
    email: input.email,
    password: input.password,
    nickname: input.nickname,
  });
  const data = unwrapData(response);
  storeAuthToken(data.token);
  return toCurrentUser(data.user);
}

export async function fetchCurrentUser() {
  const token = getStoredAuthToken();
  if (!token) return null;

  const response = await apiClient.get<ApiEnvelope<{ user: PublicUser }> | { user: PublicUser }>("/auth/me", {
    headers: authHeaders(token),
  });
  return toCurrentUser(unwrapData(response).user);
}

export async function logoutFromApi() {
  const token = getStoredAuthToken();
  if (token) {
    await apiClient.post("/auth/logout", undefined, { headers: authHeaders(token) }).catch(() => undefined);
  }
  clearStoredAuthToken();
}
