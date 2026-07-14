/**
 * 社区原型 store。
 *
 * 这里集中保存帖子、评论和互动状态。
 * 当前优先读取云端 API；失败时回退到本地 fixture，避免演示页面白屏。
 */
import { useCallback, useEffect, useState } from "react";
import {
  type CommunityComment,
  type CommunityInteractionState,
  type CommunityPost,
} from "@/data/community";
import {
  createCommunityPost,
  createPostComment,
  deleteCommunityPost,
  fetchCommunityPosts,
  fetchPostComments,
  setCommentFavorited,
  setCommentLiked,
  setPostFavorited,
  setPostLiked,
  updateCommunityPost,
} from "@/services/communityApi";
import { subscribeRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { fetchMyProfile } from "@/services/userApi";

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

const emptyInteractions: CommunityInteractionState = {
  likedPostIds: [],
  favoritePostIds: [],
  likedCommentIds: [],
  favoriteCommentIds: [],
  reportedCommentIds: [],
  userComments: [],
};

export function useCommunityState(currentUserId?: string) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [interactions, setInteractions] = useState<CommunityInteractionState>(emptyInteractions);
  const [apiReady, setApiReady] = useState(false);

  const loadCommunity = useCallback(async () => {
    try {
      const remotePosts = await fetchCommunityPosts();
      setPosts(remotePosts);
      setApiReady(true);

      const remoteComments = await Promise.all(
        remotePosts.map((post) => fetchPostComments(post.id).catch(() => []))
      );
      setComments(remoteComments.flat());
    } catch (error) {
      console.warn("Failed to load community from API.", error);
      setPosts([]);
      setComments([]);
      setApiReady(false);
    }
  }, []);

  useEffect(() => {
    setInteractions(emptyInteractions);
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;
    if (!currentUserId) return;

    fetchMyProfile()
      .then((profile) => {
        if (!cancelled) setInteractions(profile.interactions);
      })
      .catch((error) => {
        console.warn("Failed to load cloud interaction state.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;

    loadCommunity().catch(() => {
      if (!cancelled) setApiReady(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadCommunity]);

  useEffect(() => {
    return subscribeRealtimeEvents((event) => {
      if (!event.type.startsWith("community.")) return;

      if (event.type === "community.post.created" && isPostEvent(event.data)) {
        const data = event.data;
        setPosts((current) => upsertById([data.post, ...current]));
        return;
      }

      if (event.type === "community.post.updated" && isPostEvent(event.data)) {
        const data = event.data;
        setPosts((current) => current.map((post) => (post.id === data.post.id ? data.post : post)));
        return;
      }

      if (event.type === "community.post.deleted" && isPostDeletedEvent(event.data)) {
        const data = event.data;
        setPosts((current) => current.filter((post) => post.id !== data.postId));
        setComments((current) => current.filter((comment) => comment.postId !== data.postId));
        return;
      }

      if (event.type === "community.comment.created" && isCommentCreatedEvent(event.data)) {
        const data = event.data;
        setComments((current) => upsertById([data.comment, ...current]));
        if (data.post) {
          setPosts((current) => current.map((post) => (post.id === data.post!.id ? data.post! : post)));
        }
        return;
      }

      if (event.type === "community.comment.updated" && isCommentUpdatedEvent(event.data)) {
        const data = event.data;
        setComments((current) => current.map((comment) => (comment.id === data.comment.id ? data.comment : comment)));
        return;
      }

      if (event.type === "community.comment.deleted" && isCommentDeletedEvent(event.data)) {
        const data = event.data;
        setComments((current) => current.filter((comment) => comment.id !== data.commentId));
        if (data.post) {
          setPosts((current) => current.map((post) => (post.id === data.post!.id ? data.post! : post)));
        }
        return;
      }

      loadCommunity();
    });
  }, [loadCommunity]);

  const publishPost = async (input: {
    title: string;
    text: string;
    channel: CommunityPost["channel"];
    topic: CommunityPost["topic"];
    mediaType: CommunityPost["mediaType"];
    mediaSource: CommunityPost["mediaSource"];
    mediaUrl?: string;
    mediaMimeType?: string;
    place: string;
    imageTone: CommunityPost["imageTone"];
  }) => {
    if (!apiReady) throw new Error("Community API is not ready.");

    const post = await createCommunityPost(input);
    setPosts((current) => [post, ...current]);
    return post;
  };

  const publishComment = async (post: CommunityPost, text: string) => {
    if (!apiReady) throw new Error("Community API is not ready.");

    const comment = await createPostComment(post.id, text);
    setComments((current) => [comment, ...current]);
    setPosts((current) =>
      current.map((item) => (item.id === post.id ? { ...item, comments: item.comments + 1 } : item))
    );
    setInteractions((current) => ({
      ...current,
      userComments: [
        { id: comment.id, postId: post.id, postTitle: post.title, text, time: comment.time },
        ...current.userComments,
      ],
    }));
    return comment;
  };

  const editPost = async (postId: string, patch: Parameters<typeof updateCommunityPost>[1]) => {
    if (!apiReady) throw new Error("Community API is not ready.");

    const post = await updateCommunityPost(postId, patch);
    setPosts((current) => current.map((item) => (item.id === postId ? post : item)));
    return post;
  };

  const deletePost = async (postId: string) => {
    if (!apiReady) throw new Error("Community API is not ready.");

    await deleteCommunityPost(postId);
    setPosts((current) => current.filter((item) => item.id !== postId));
    setComments((current) => current.filter((comment) => comment.postId !== postId));
  };

  const togglePostLike = async (postId: string) => {
    const nextLiked = !interactions.likedPostIds.includes(postId);
    setInteractions((current) => ({ ...current, likedPostIds: toggleValue(current.likedPostIds, postId) }));

    if (!apiReady) return;
    try {
      const post = await setPostLiked(postId, nextLiked);
      setPosts((current) => current.map((item) => (item.id === postId ? post : item)));
    } catch (error) {
      console.warn("Like API failed, keeping local interaction state.", error);
    }
  };

  const togglePostFavorite = async (postId: string) => {
    const nextFavorited = !interactions.favoritePostIds.includes(postId);
    setInteractions((current) => ({ ...current, favoritePostIds: toggleValue(current.favoritePostIds, postId) }));

    if (!apiReady) return;
    try {
      const post = await setPostFavorited(postId, nextFavorited);
      setPosts((current) => current.map((item) => (item.id === postId ? post : item)));
    } catch (error) {
      console.warn("Favorite API failed, keeping local interaction state.", error);
    }
  };

  const toggleCommentLike = async (commentId: string) => {
    const nextLiked = !interactions.likedCommentIds.includes(commentId);
    setInteractions((current) => ({ ...current, likedCommentIds: toggleValue(current.likedCommentIds, commentId) }));

    if (!apiReady) return;
    try {
      const comment = await setCommentLiked(commentId, nextLiked);
      setComments((current) => current.map((item) => (item.id === commentId ? comment : item)));
    } catch (error) {
      console.warn("Comment like API failed, keeping local interaction state.", error);
    }
  };

  const toggleCommentFavorite = async (commentId: string) => {
    const nextFavorited = !interactions.favoriteCommentIds.includes(commentId);
    setInteractions((current) => ({ ...current, favoriteCommentIds: toggleValue(current.favoriteCommentIds, commentId) }));

    if (!apiReady) return;
    try {
      const comment = await setCommentFavorited(commentId, nextFavorited);
      setComments((current) => current.map((item) => (item.id === commentId ? comment : item)));
    } catch (error) {
      console.warn("Comment favorite API failed, keeping local interaction state.", error);
    }
  };

  return {
    posts,
    comments,
    interactions,
    setPosts,
    setComments,
    setInteractions,
    publishPost,
    publishComment,
    editPost,
    deletePost,
    togglePostLike,
    togglePostFavorite,
    toggleCommentLike,
    toggleCommentFavorite,
  };
}

function upsertById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function isPostEvent(data: unknown): data is { post: CommunityPost } {
  return Boolean(data && typeof data === "object" && "post" in data && (data as { post?: { id?: unknown } }).post?.id);
}

function isPostDeletedEvent(data: unknown): data is { postId: string } {
  return Boolean(data && typeof data === "object" && typeof (data as { postId?: unknown }).postId === "string");
}

function isCommentCreatedEvent(data: unknown): data is { postId: string; comment: CommunityComment; post?: CommunityPost } {
  return Boolean(data && typeof data === "object" && "comment" in data && (data as { comment?: { id?: unknown } }).comment?.id);
}

function isCommentUpdatedEvent(data: unknown): data is { postId: string; comment: CommunityComment } {
  return Boolean(data && typeof data === "object" && "comment" in data && (data as { comment?: { id?: unknown } }).comment?.id);
}

function isCommentDeletedEvent(data: unknown): data is { postId: string; commentId: string; post?: CommunityPost } {
  return Boolean(data && typeof data === "object" && typeof (data as { commentId?: unknown }).commentId === "string");
}
