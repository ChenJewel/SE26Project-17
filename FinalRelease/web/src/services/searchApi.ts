import type { CommunityPost } from "@/data/community";
import { apiClient } from "@/services/apiClient";
import type { FollowSummary } from "@/services/userApi";
import type { MealCard } from "@/types/meal";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface SearchUser {
  id: string;
  email: string;
  nickname: string;
  avatarText: string;
  avatarUrl?: string;
  verified: boolean;
  school?: string;
  preferenceTags?: string[];
  follow?: FollowSummary;
  highlights?: Record<string, string>;
}

export interface SearchResponse {
  query: string;
  page?: number;
  limit?: number;
  hasMore?: boolean;
  suggestion?: string;
  users: SearchUser[];
  posts: Array<CommunityPost & { highlights?: Record<string, string> }>;
  cards: Array<MealCard & { highlights?: Record<string, string> }>;
}

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (response && typeof response === "object" && "success" in response && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }
  return response as T;
}

export async function searchAll(query: string, limit = 20, page = 1) {
  const params = new URLSearchParams({ q: query, limit: String(limit), page: String(page) });
  const response = await apiClient.get<ApiEnvelope<SearchResponse> | SearchResponse>(`/search?${params.toString()}`);
  return unwrapData(response);
}
