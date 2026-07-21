/**
 * 社区原型 store。
 *
 * 这里集中保存帖子、评论和互动状态。
 * 当前优先读取云端 API；失败时回退到本地 fixture，避免演示页面白屏。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CommunityComment,
  type CommunityInteractionState,
  type CommunityPost,
} from "@/data/community";
import {
  createCommunityPost,
  createPostComment,
  deleteCommunityPost,
  deletePostComment,
  fetchCommunityPosts,
  fetchPostComments,
  replyPostComment,
  shareCommunityPost,
  setCommentFavorited,
  setCommentLiked,
  setPostFavorited,
  setPostLiked,
  updateCommunityPost,
} from "@/services/communityApi";
import { subscribeRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { fetchMyProfile } from "@/services/userApi";

function setValue(list: string[], value: string, enabled: boolean) {
  if (enabled) return list.includes(value) ? list : [...list, value];
  return list.filter((item) => item !== value);
}

function formatInteractionCount(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}w`;
  return String(Math.max(0, value));
}

function readInteractionCount(value: string | undefined) {
  if (!value) return 0;
  const normalized = value.trim().toLowerCase();
  const parsed = Number.parseFloat(normalized.replace(/[a-z]+$/, ""));
  if (!Number.isFinite(parsed)) return 0;
  if (normalized.endsWith("m")) return Math.round(parsed * 1000000);
  if (normalized.endsWith("k")) return Math.round(parsed * 1000);
  if (normalized.endsWith("w")) return Math.round(parsed * 10000);
  return Math.round(parsed);
}

function adjustInteractionCount(value: string | undefined, delta: number) {
  return formatInteractionCount(readInteractionCount(value) + delta);
}

function adjustPostCounter(postId: string, key: "likes" | "favorites", delta: number) {
  return (current: CommunityPost[]) =>
    current.map((post) => (post.id === postId ? { ...post, [key]: adjustInteractionCount(post[key], delta) } : post));
}

function adjustCommentCounter(commentId: string, key: "likes" | "favorites", delta: number) {
  return (current: CommunityComment[]) =>
    current.map((comment) =>
      comment.id === commentId ? { ...comment, [key]: adjustInteractionCount(comment[key], delta) } : comment
    );
}

function revertInteractionToggle(
  key: "likedPostIds" | "favoritePostIds" | "likedCommentIds" | "favoriteCommentIds",
  value: string,
  attemptedEnabled: boolean
) {
  return (current: CommunityInteractionState): CommunityInteractionState => ({
    ...current,
    [key]: attemptedEnabled
      ? current[key].filter((item) => item !== value)
      : current[key].includes(value)
        ? current[key]
        : [...current[key], value],
  });
}

function setInteractionValue(
  key: "likedPostIds" | "favoritePostIds" | "likedCommentIds" | "favoriteCommentIds",
  value: string,
  enabled: boolean
) {
  return (current: CommunityInteractionState): CommunityInteractionState => ({
    ...current,
    [key]: setValue(current[key], value, enabled),
  });
}

function matchesInteractionValue(
  state: CommunityInteractionState,
  key: "likedPostIds" | "favoritePostIds" | "likedCommentIds" | "favoriteCommentIds",
  value: string,
  enabled: boolean
) {
  return state[key].includes(value) === enabled;
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
  const interactionsRef = useRef(emptyInteractions);
  const [apiReady, setApiReady] = useState(false);

  const applyInteractions = (updater: (current: CommunityInteractionState) => CommunityInteractionState) => {
    const next = updater(interactionsRef.current);
    interactionsRef.current = next;
    setInteractions(next);
  };

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
    interactionsRef.current = interactions;
  }, [interactions]);

  useEffect(() => {
    interactionsRef.current = emptyInteractions;
    setInteractions(emptyInteractions);
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;
    if (!currentUserId) return;

    fetchMyProfile()
      .then((profile) => {
        if (!cancelled) {
          interactionsRef.current = profile.interactions;
          setInteractions(profile.interactions);
        }
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
      if (event.type === "user.profile.updated" && isUserProfileUpdatedEvent(event.data)) {
        const user = event.data.user;
        setPosts((current) => current.map((post) => post.authorId === user.id ? {
          ...post,
          author: user.nickname,
          avatar: user.avatarText,
          avatarUrl: user.avatarUrl,
          verified: user.verified,
        } : post));
        setComments((current) => current.map((comment) => comment.authorId === user.id ? {
          ...comment,
          author: user.nickname,
          avatar: user.avatarText,
          avatarUrl: user.avatarUrl,
        } : comment));
        return;
      }

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
    mediaUrls?: string[];
    mediaPosterUrl?: string;
    mediaMimeType?: string;
    place: string;
    imageTone: CommunityPost["imageTone"];
  }) => {
    if (!apiReady) throw new Error("Community API is not ready.");

    const post = await createCommunityPost(input);
    setPosts((current) => upsertById([post, ...current]));
    return post;
  };

  const publishComment = async (post: CommunityPost, text: string, parentCommentId?: string) => {
    if (!apiReady) throw new Error("Community API is not ready.");

    const comment = parentCommentId
      ? await replyPostComment(post.id, text, parentCommentId)
      : await createPostComment(post.id, text);
    setComments((current) => upsertById([comment, ...current]));
    setPosts((current) =>
      current.map((item) => (item.id === post.id ? { ...item, comments: item.comments + 1 } : item))
    );
    setInteractions((current) => ({
      ...current,
      userComments: [
        ...upsertById([
          { id: comment.id, postId: post.id, postTitle: post.title, text, time: comment.time },
          ...current.userComments,
        ]),
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

  const deleteComment = async (commentId: string) => {
    if (!apiReady) throw new Error("Community API is not ready.");

    const comment = comments.find((item) => item.id === commentId);
    await deletePostComment(commentId);
    setComments((current) => current.filter((item) => item.id !== commentId));
    if (comment) {
      setPosts((current) =>
        current.map((post) => (post.id === comment.postId ? { ...post, comments: Math.max(0, post.comments - 1) } : post))
      );
    }
    setInteractions((current) => ({
      ...current,
      userComments: current.userComments.filter((item) => item.id !== commentId),
    }));
  };

  const togglePostLike = async (postId: string) => {
    const nextLiked = !interactionsRef.current.likedPostIds.includes(postId);
    const optimisticDelta = nextLiked ? 1 : -1;
    applyInteractions(setInteractionValue("likedPostIds", postId, nextLiked));
    setPosts(adjustPostCounter(postId, "likes", optimisticDelta));

    if (!apiReady) return;
    try {
      const post = await setPostLiked(postId, nextLiked);
      if (matchesInteractionValue(interactionsRef.current, "likedPostIds", postId, nextLiked)) {
        setPosts((current) => current.map((item) => (item.id === postId ? post : item)));
      }
    } catch (error) {
      if (matchesInteractionValue(interactionsRef.current, "likedPostIds", postId, nextLiked)) {
        applyInteractions(revertInteractionToggle("likedPostIds", postId, nextLiked));
        setPosts(adjustPostCounter(postId, "likes", -optimisticDelta));
      }
      console.warn("Like API failed, reverted local interaction state.", error);
    }
  };

  const togglePostFavorite = async (postId: string) => {
    const nextFavorited = !interactionsRef.current.favoritePostIds.includes(postId);
    const optimisticDelta = nextFavorited ? 1 : -1;
    applyInteractions(setInteractionValue("favoritePostIds", postId, nextFavorited));
    setPosts(adjustPostCounter(postId, "favorites", optimisticDelta));

    if (!apiReady) return;
    try {
      const post = await setPostFavorited(postId, nextFavorited);
      if (matchesInteractionValue(interactionsRef.current, "favoritePostIds", postId, nextFavorited)) {
        setPosts((current) => current.map((item) => (item.id === postId ? post : item)));
      }
    } catch (error) {
      if (matchesInteractionValue(interactionsRef.current, "favoritePostIds", postId, nextFavorited)) {
        applyInteractions(revertInteractionToggle("favoritePostIds", postId, nextFavorited));
        setPosts(adjustPostCounter(postId, "favorites", -optimisticDelta));
      }
      console.warn("Favorite API failed, reverted local interaction state.", error);
    }
  };

  const toggleCommentLike = async (commentId: string) => {
    const nextLiked = !interactionsRef.current.likedCommentIds.includes(commentId);
    const optimisticDelta = nextLiked ? 1 : -1;
    applyInteractions(setInteractionValue("likedCommentIds", commentId, nextLiked));
    setComments(adjustCommentCounter(commentId, "likes", optimisticDelta));

    if (!apiReady) return;
    try {
      const comment = await setCommentLiked(commentId, nextLiked);
      if (matchesInteractionValue(interactionsRef.current, "likedCommentIds", commentId, nextLiked)) {
        setComments((current) => current.map((item) => (item.id === commentId ? comment : item)));
      }
    } catch (error) {
      if (matchesInteractionValue(interactionsRef.current, "likedCommentIds", commentId, nextLiked)) {
        applyInteractions(revertInteractionToggle("likedCommentIds", commentId, nextLiked));
        setComments(adjustCommentCounter(commentId, "likes", -optimisticDelta));
      }
      console.warn("Comment like API failed, reverted local interaction state.", error);
    }
  };

  const toggleCommentFavorite = async (commentId: string) => {
    const nextFavorited = !interactionsRef.current.favoriteCommentIds.includes(commentId);
    const optimisticDelta = nextFavorited ? 1 : -1;
    applyInteractions(setInteractionValue("favoriteCommentIds", commentId, nextFavorited));
    setComments(adjustCommentCounter(commentId, "favorites", optimisticDelta));

    if (!apiReady) return;
    try {
      const comment = await setCommentFavorited(commentId, nextFavorited);
      if (matchesInteractionValue(interactionsRef.current, "favoriteCommentIds", commentId, nextFavorited)) {
        setComments((current) => current.map((item) => (item.id === commentId ? comment : item)));
      }
    } catch (error) {
      if (matchesInteractionValue(interactionsRef.current, "favoriteCommentIds", commentId, nextFavorited)) {
        applyInteractions(revertInteractionToggle("favoriteCommentIds", commentId, nextFavorited));
        setComments(adjustCommentCounter(commentId, "favorites", -optimisticDelta));
      }
      console.warn("Comment favorite API failed, reverted local interaction state.", error);
    }
  };

  const sharePost = async (postId: string) => {
    if (!apiReady) return;
    try {
      const post = await shareCommunityPost(postId);
      setPosts((current) => current.map((item) => (item.id === postId ? post : item)));
    } catch (error) {
      console.warn("Share API failed, keeping local state.", error);
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
    deleteComment,
    togglePostLike,
    togglePostFavorite,
    toggleCommentLike,
    toggleCommentFavorite,
    sharePost,
    refreshCommunity: loadCommunity,
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

function isUserProfileUpdatedEvent(data: unknown): data is { user: { id: string; nickname: string; avatarText: string; avatarUrl?: string; verified: boolean } } {
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
