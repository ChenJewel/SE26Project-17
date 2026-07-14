import { apiClient } from "@/services/apiClient";
import type {
  CommunityChannel,
  CommunityComment,
  CommunityMediaSource,
  CommunityMediaType,
  CommunityPost,
  CommunityTopic,
} from "@/data/community";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

type BackendPost = Omit<CommunityPost, "channel" | "topic" | "likes" | "favorites" | "shares" | "imageTone"> & {
  channel: string;
  topic: string;
  likes: number;
  favorites: number;
  shares: number;
  imageTone?: CommunityPost["imageTone"];
};

type BackendComment = Omit<CommunityComment, "likes" | "time"> & {
  likes: number;
  favorites?: number;
  createdAt: string;
};

interface PostsResponse {
  posts: BackendPost[];
}

interface PostResponse {
  post: BackendPost;
}

interface CommentsResponse {
  comments: BackendComment[];
}

interface CommentResponse {
  comment: BackendComment;
}

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (response && typeof response === "object" && "success" in response && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }

  return response as T;
}

function toTopic(value: string): CommunityTopic {
  if (value === "餐厅" || value.toLowerCase() === "dining") return "餐厅";
  if (value === "经验" || value.toLowerCase() === "backend") return "经验";
  return "生活";
}

function toChannel(value: string, topic: CommunityTopic): CommunityChannel {
  if (value === "推荐" || value === "关注" || value === "附近" || value === "餐厅" || value === "生活" || value === "经验") {
    return value;
  }

  if (value.toLowerCase() === "dining") return "餐厅";
  return topic;
}

function toMediaType(value: unknown): CommunityMediaType {
  return value === "photo" || value === "video" ? value : "text";
}

function toMediaSource(value: unknown): CommunityMediaSource {
  return value === "album" || value === "camera" ? value : "text";
}

function formatCount(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}w`;
  return String(value);
}

function formatRelativeTime(value: string) {
  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) return "刚刚";
  const diffMs = Date.now() - createdAt;
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function defaultImageTone(post: BackendPost): CommunityPost["imageTone"] {
  if (post.mediaType === "video") return "road";
  if (post.topic.toLowerCase() === "dining" || post.topic === "餐厅") return "window";
  if (post.topic === "经验") return "note";
  return "campus";
}

function mapPost(post: BackendPost): CommunityPost {
  const topic = toTopic(post.topic);
  return {
    ...post,
    channel: toChannel(post.channel, topic),
    topic,
    mediaType: toMediaType(post.mediaType),
    mediaSource: toMediaSource(post.mediaSource),
    likes: formatCount(post.likes),
    favorites: formatCount(post.favorites),
    shares: formatCount(post.shares),
    imageTone: post.imageTone ?? defaultImageTone(post),
  };
}

function mapComment(comment: BackendComment): CommunityComment {
  return {
    ...comment,
    likes: formatCount(comment.likes),
    favorites: formatCount(comment.favorites ?? 0),
    time: formatRelativeTime(comment.createdAt),
  };
}

export async function fetchCommunityPosts() {
  const response = await apiClient.get<ApiEnvelope<PostsResponse> | PostsResponse>("/posts");
  return unwrapData(response).posts.map(mapPost);
}

export async function createCommunityPost(input: {
  title: string;
  text: string;
  channel: CommunityChannel;
  topic: CommunityTopic;
  mediaType: CommunityMediaType;
  mediaSource: CommunityMediaSource;
  mediaUrl?: string;
  mediaMimeType?: string;
  place: string;
}) {
  const response = await apiClient.post<ApiEnvelope<PostResponse> | PostResponse>("/posts", input);
  return mapPost(unwrapData(response).post);
}

export async function updateCommunityPost(
  postId: string,
  input: Partial<{
    title: string;
    text: string;
    channel: CommunityChannel;
    topic: CommunityTopic;
    mediaType: CommunityMediaType;
    mediaSource: CommunityMediaSource;
    mediaUrl: string;
    mediaMimeType: string;
    place: string;
  }>
) {
  const response = await apiClient.patch<ApiEnvelope<PostResponse> | PostResponse>(`/posts/${postId}`, input);
  return mapPost(unwrapData(response).post);
}

export async function deleteCommunityPost(postId: string) {
  await apiClient.delete<ApiEnvelope<{ deleted: boolean; postId: string }> | { deleted: boolean; postId: string }>(`/posts/${postId}`);
  return postId;
}

export async function fetchPostComments(postId: string) {
  const response = await apiClient.get<ApiEnvelope<CommentsResponse> | CommentsResponse>(`/posts/${postId}/comments`);
  return unwrapData(response).comments.map(mapComment);
}

export async function createPostComment(postId: string, text: string) {
  const response = await apiClient.post<ApiEnvelope<CommentResponse> | CommentResponse>(
    `/posts/${postId}/comments`,
    { text }
  );
  return mapComment(unwrapData(response).comment);
}

export async function setPostLiked(postId: string, liked: boolean) {
  const response = liked
    ? await apiClient.post<ApiEnvelope<PostResponse> | PostResponse>(`/posts/${postId}/like`)
    : await apiClient.delete<ApiEnvelope<PostResponse> | PostResponse>(`/posts/${postId}/like`);
  return mapPost(unwrapData(response).post);
}

export async function setPostFavorited(postId: string, favorited: boolean) {
  const response = favorited
    ? await apiClient.post<ApiEnvelope<PostResponse> | PostResponse>(`/posts/${postId}/favorite`)
    : await apiClient.delete<ApiEnvelope<PostResponse> | PostResponse>(`/posts/${postId}/favorite`);
  return mapPost(unwrapData(response).post);
}

export async function setCommentLiked(commentId: string, liked: boolean) {
  const response = liked
    ? await apiClient.post<ApiEnvelope<CommentResponse> | CommentResponse>(`/comments/${commentId}/like`)
    : await apiClient.delete<ApiEnvelope<CommentResponse> | CommentResponse>(`/comments/${commentId}/like`);
  return mapComment(unwrapData(response).comment);
}

export async function setCommentFavorited(commentId: string, favorited: boolean) {
  const response = favorited
    ? await apiClient.post<ApiEnvelope<CommentResponse> | CommentResponse>(`/comments/${commentId}/favorite`)
    : await apiClient.delete<ApiEnvelope<CommentResponse> | CommentResponse>(`/comments/${commentId}/favorite`);
  return mapComment(unwrapData(response).comment);
}
