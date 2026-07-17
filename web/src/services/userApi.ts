import type { CommunityComment, CommunityInteractionState, CommunityPost, UserComment } from "@/data/community";
import { apiClient } from "@/services/apiClient";
import type { CurrentUser } from "@/types/auth";
import type { MealCard } from "@/types/meal";
import type { UserSummary } from "@/types/user";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface PublicUser {
  id: string;
  email: string;
  role?: "user" | "admin";
  nickname: string;
  avatarText: string;
  avatarUrl?: string;
  verified: boolean;
  school?: string;
  bio?: string;
  preferenceTags?: string[];
  profileCompleted?: boolean;
}

interface BackendComment extends Omit<CommunityComment, "likes" | "favorites" | "time"> {
  likes: number;
  favorites?: number;
  createdAt: string;
}

export interface FollowSummary {
  following: boolean;
  followedBy: boolean;
  mutual: boolean;
  followerCount: number;
  followingCount: number;
}

export interface ProfileStats {
  followerCount: number;
  followingCount: number;
  postCount: number;
  cardCount: number;
  commentCount: number;
  likedPostCount: number;
  favoritePostCount: number;
}

interface ProfileResponse {
  user: PublicUser;
  cards: MealCard[];
  posts: CommunityPost[];
  followedUsers: PublicUser[];
  followers: PublicUser[];
  likedPosts?: CommunityPost[];
  favoritePosts?: CommunityPost[];
  comments?: BackendComment[];
  likedComments?: BackendComment[];
  favoriteComments?: BackendComment[];
  interactions?: Pick<CommunityInteractionState, "likedPostIds" | "favoritePostIds" | "likedCommentIds" | "favoriteCommentIds">;
  stats?: ProfileStats;
}

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (response && typeof response === "object" && "success" in response && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }
  return response as T;
}

export function toCurrentUser(user: PublicUser): CurrentUser {
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
    role: user.role,
    bio: user.bio,
    preferenceTags: user.preferenceTags ?? [],
    profileCompleted: user.profileCompleted,
  };
}

function toUserSummary(user: PublicUser, source = "关注"): UserSummary {
  return {
    userId: user.id,
    name: user.nickname,
    avatar: user.avatarText,
    avatarUrl: user.avatarUrl,
    source,
    verified: user.verified,
    bio: user.bio,
    school: user.school,
  };
}

function formatCount(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}w`;
  return String(value);
}

function formatRelativeTime(value: string) {
  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) return "刚刚";
  const minutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function toCommunityComment(comment: BackendComment): CommunityComment {
  return {
    ...comment,
    likes: formatCount(comment.likes),
    favorites: formatCount(comment.favorites ?? 0),
    time: formatRelativeTime(comment.createdAt),
  };
}

function toUserComment(comment: CommunityComment, posts: CommunityPost[]): UserComment {
  return {
    id: comment.id,
    postId: comment.postId,
    postTitle: posts.find((post) => post.id === comment.postId)?.title ?? "社区帖子",
    text: comment.text,
    time: comment.time,
  };
}

export async function fetchMyProfile() {
  const response = await apiClient.get<ApiEnvelope<ProfileResponse> | ProfileResponse>("/users/me/profile");
  const data = unwrapData(response);
  const comments = (data.comments ?? []).map(toCommunityComment);

  return {
    user: toCurrentUser(data.user),
    preferenceTags: data.user.preferenceTags ?? [],
    cards: data.cards,
    posts: data.posts,
    followedUsers: data.followedUsers.map((user) => toUserSummary(user, "我关注的人")),
    followers: data.followers.map((user) => toUserSummary(user, "关注我的人")),
    likedPosts: data.likedPosts ?? [],
    favoritePosts: data.favoritePosts ?? [],
    comments,
    likedComments: (data.likedComments ?? []).map(toCommunityComment),
    favoriteComments: (data.favoriteComments ?? []).map(toCommunityComment),
    interactions: {
      likedPostIds: data.interactions?.likedPostIds ?? [],
      favoritePostIds: data.interactions?.favoritePostIds ?? [],
      likedCommentIds: data.interactions?.likedCommentIds ?? [],
      favoriteCommentIds: data.interactions?.favoriteCommentIds ?? [],
      reportedCommentIds: [],
      userComments: comments.map((comment) => toUserComment(comment, data.posts)),
    } satisfies CommunityInteractionState,
    stats: data.stats ?? {
      followerCount: data.followers.length,
      followingCount: data.followedUsers.length,
      postCount: data.posts.length,
      cardCount: data.cards.length,
      commentCount: comments.length,
      likedPostCount: data.likedPosts?.length ?? 0,
      favoritePostCount: data.favoritePosts?.length ?? 0,
    },
  };
}

export async function updateMyProfile(input: {
  nickname?: string;
  avatarText?: string;
  avatarUrl?: string;
  school?: string;
  bio?: string;
  preferenceTags?: string[];
  profileCompleted?: boolean;
}) {
  const response = await apiClient.patch<ApiEnvelope<{ user: PublicUser }> | { user: PublicUser }>("/users/me", input);
  return toCurrentUser(unwrapData(response).user);
}

export async function followUser(userId: string) {
  const response = await apiClient.post<ApiEnvelope<{ follow: FollowSummary }> | { follow: FollowSummary }>(`/users/${userId}/follow`);
  return unwrapData(response).follow;
}

export async function unfollowUser(userId: string) {
  const response = await apiClient.delete<ApiEnvelope<{ follow: FollowSummary }> | { follow: FollowSummary }>(`/users/${userId}/follow`);
  return unwrapData(response).follow;
}

export async function fetchFollowSummary(userId: string) {
  const response = await apiClient.get<ApiEnvelope<{ follow: FollowSummary }> | { follow: FollowSummary }>(
    `/users/${userId}/follow-summary`
  );
  return unwrapData(response).follow;
}

export async function fetchPublicUser(userId: string) {
  const response = await apiClient.get<ApiEnvelope<{ user: PublicUser; follow?: FollowSummary }> | { user: PublicUser; follow?: FollowSummary }>(
    `/users/${userId}`
  );
  const data = unwrapData(response);
  return {
    user: data.user,
    summary: toUserSummary(data.user, data.user.school ?? data.user.email),
    follow: data.follow,
  };
}
