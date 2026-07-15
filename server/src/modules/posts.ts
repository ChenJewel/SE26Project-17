import { Router } from "express";
import { sendFailure, sendSuccess } from "../common/http.js";
import { getCurrentUserId, numberValue, optionalString, requiredString } from "../common/request.js";
import { postgresStore } from "../data/postgres.js";
import { makeId, timestamp } from "../data/store.js";
import { realtimeHub } from "../realtime.js";
import type { CommunityComment, CommunityPost } from "../types.js";

export const postsRouter = Router();

postsRouter.get("/", async (_req, res) => {
  const posts = await postgresStore.listPublishedPosts();
  sendSuccess(res, { posts });
});

postsRouter.post("/", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const user = await postgresStore.findUserById(currentUserId);
  const body = req.body as Record<string, unknown>;

  if (!user) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  if (!requiredString(body.title) || !requiredString(body.text)) {
    sendFailure(res, 400, "INVALID_POST", "title and text are required.");
    return;
  }

  const mediaType = body.mediaType === "photo" || body.mediaType === "video" ? body.mediaType : "text";
  const mediaUrls = sanitizeMediaUrls(body.mediaUrls, body.mediaUrl, mediaType);
  const createdAt = timestamp();
  const post: CommunityPost = {
    id: makeId("post"),
    authorId: user.id,
    title: body.title.trim(),
    text: body.text.trim(),
    author: user.nickname,
    avatar: user.avatarText,
    channel: optionalString(body.channel) && body.channel?.trim() ? body.channel.trim() : "Recommended",
    topic: optionalString(body.topic) && body.topic?.trim() ? body.topic.trim() : "Life",
    mediaType,
    mediaSource: body.mediaSource === "album" || body.mediaSource === "camera" ? body.mediaSource : "text",
    mediaUrl: mediaUrls[0],
    mediaUrls,
    mediaMimeType: optionalString(body.mediaMimeType) && body.mediaMimeType?.trim() ? body.mediaMimeType.trim() : undefined,
    place: optionalString(body.place) && body.place?.trim() ? body.place.trim() : "Campus",
    likes: 0,
    favorites: 0,
    comments: 0,
    shares: 0,
    verified: user.verified,
    createdAt,
    updatedAt: createdAt,
    status: "published",
  };

  await postgresStore.createPost(post);
  realtimeHub.broadcastAll({
    type: "community.post.created",
    data: { post },
    createdAt,
  });
  sendSuccess(res, { post }, 201);
});

postsRouter.get("/:postId", async (req, res) => {
  const post = await postgresStore.findPost(req.params.postId);
  if (!post) {
    sendFailure(res, 404, "POST_NOT_FOUND", "Post not found.");
    return;
  }

  sendSuccess(res, { post });
});

postsRouter.patch("/:postId", async (req, res) => {
  const post = await postgresStore.findPost(req.params.postId);
  if (!post) {
    sendFailure(res, 404, "POST_NOT_FOUND", "Post not found.");
    return;
  }

  const currentUser = await postgresStore.findUserById(getCurrentUserId(req));
  if (!currentUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  if (!canManagePost(currentUser, post)) {
    sendFailure(res, 403, "FORBIDDEN", "Only the post author or an admin can edit this post.");
    return;
  }

  const body = req.body as Record<string, unknown>;
  const nextMediaType =
    body.mediaType === "text" || body.mediaType === "photo" || body.mediaType === "video" ? body.mediaType : post.mediaType;
  const mediaPatch =
    "mediaUrls" in body || "mediaUrl" in body
      ? (() => {
          const mediaUrls = sanitizeMediaUrls(body.mediaUrls, body.mediaUrl, nextMediaType);
          return { mediaUrl: mediaUrls[0], mediaUrls };
        })()
      : {};
  const updatedPost = await postgresStore.updatePost(post.id, {
    ...(optionalString(body.title) && body.title !== undefined ? { title: body.title.trim() } : {}),
    ...(optionalString(body.text) && body.text !== undefined ? { text: body.text.trim() } : {}),
    ...(optionalString(body.channel) && body.channel !== undefined ? { channel: body.channel.trim() } : {}),
    ...(optionalString(body.topic) && body.topic !== undefined ? { topic: body.topic.trim() } : {}),
    ...(body.mediaType === "text" || body.mediaType === "photo" || body.mediaType === "video" ? { mediaType: body.mediaType } : {}),
    ...(body.mediaSource === "text" || body.mediaSource === "album" || body.mediaSource === "camera" ? { mediaSource: body.mediaSource } : {}),
    ...mediaPatch,
    ...(typeof body.mediaMimeType === "string" ? { mediaMimeType: body.mediaMimeType.trim() } : {}),
    ...(optionalString(body.place) && body.place !== undefined ? { place: body.place.trim() } : {}),
    ...(numberValue(body.shares) ? { shares: body.shares } : {}),
  });

  if (updatedPost) {
    realtimeHub.broadcastAll({
      type: "community.post.updated",
      data: { post: updatedPost },
      createdAt: updatedPost.updatedAt,
    });
  }

  sendSuccess(res, { post: updatedPost });
});

postsRouter.post("/:postId/share", async (req, res) => {
  const post = await postgresStore.findPublishedPost(req.params.postId);
  const currentUser = await postgresStore.findUserById(getCurrentUserId(req));
  if (!post) {
    sendFailure(res, 404, "POST_NOT_FOUND", "Post not found.");
    return;
  }

  if (!currentUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  const updatedPost = await postgresStore.updatePost(post.id, { shares: post.shares + 1 });
  if (updatedPost) {
    realtimeHub.broadcastAll({
      type: "community.post.updated",
      data: { post: updatedPost },
      createdAt: updatedPost.updatedAt,
    });
  }

  sendSuccess(res, { post: updatedPost, shared: true });
});

postsRouter.delete("/:postId", async (req, res) => {
  const post = await postgresStore.findPost(req.params.postId);
  if (!post) {
    sendFailure(res, 404, "POST_NOT_FOUND", "Post not found.");
    return;
  }

  const currentUser = await postgresStore.findUserById(getCurrentUserId(req));
  if (!currentUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  if (!canManagePost(currentUser, post)) {
    sendFailure(res, 403, "FORBIDDEN", "Only the post author or an admin can delete this post.");
    return;
  }

  await postgresStore.updatePost(post.id, { status: "deleted" });
  realtimeHub.broadcastAll({
    type: "community.post.deleted",
    data: { postId: post.id },
    createdAt: new Date().toISOString(),
  });
  sendSuccess(res, { deleted: true, postId: post.id });
});

postsRouter.post("/:postId/like", async (req, res) => {
  await togglePostCounter(req.params.postId, getCurrentUserId(req), "like", true, res);
});

postsRouter.delete("/:postId/like", async (req, res) => {
  await togglePostCounter(req.params.postId, getCurrentUserId(req), "like", false, res);
});

postsRouter.post("/:postId/favorite", async (req, res) => {
  await togglePostCounter(req.params.postId, getCurrentUserId(req), "favorite", true, res);
});

postsRouter.delete("/:postId/favorite", async (req, res) => {
  await togglePostCounter(req.params.postId, getCurrentUserId(req), "favorite", false, res);
});

postsRouter.get("/:postId/comments", async (req, res) => {
  const comments = await postgresStore.listPublishedComments(req.params.postId);
  sendSuccess(res, { comments });
});

postsRouter.post("/:postId/comments", async (req, res) => {
  const post = await postgresStore.findPublishedPost(req.params.postId);
  const currentUserId = getCurrentUserId(req);
  const user = await postgresStore.findUserById(currentUserId);
  const body = req.body as Record<string, unknown>;

  if (!post) {
    sendFailure(res, 404, "POST_NOT_FOUND", "Post not found.");
    return;
  }

  if (!user) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  if (!requiredString(body.text)) {
    sendFailure(res, 400, "INVALID_COMMENT", "text is required.");
    return;
  }

  let parentComment: CommunityComment | undefined;
  const parentCommentId = typeof body.parentCommentId === "string" ? body.parentCommentId.trim() : "";
  if (parentCommentId) {
    parentComment = await postgresStore.findComment(parentCommentId);
    if (!parentComment || parentComment.postId !== post.id) {
      sendFailure(res, 400, "INVALID_COMMENT_REPLY", "Parent comment was not found on this post.");
      return;
    }
  }

  const createdAt = timestamp();
  const comment: CommunityComment = {
    id: makeId("comment"),
    postId: post.id,
    authorId: user.id,
    author: user.nickname,
    avatar: user.avatarText,
    text: body.text.trim(),
    parentCommentId: parentComment?.id,
    replyToUserId: parentComment?.authorId,
    replyToAuthor: parentComment?.author,
    likes: 0,
    createdAt,
    updatedAt: createdAt,
    status: "published",
  };

  await postgresStore.createComment(comment);
  const updatedPost = await postgresStore.updatePost(post.id, { comments: post.comments + 1 });
  realtimeHub.broadcastAll({
    type: "community.comment.created",
    data: { postId: post.id, comment, post: updatedPost },
    createdAt,
  });
  if (parentComment && parentComment.authorId !== user.id) {
    const notification = await postgresStore.createNotification({
      id: makeId("notif"),
      userId: parentComment.authorId,
      type: "comment",
      actorUserId: user.id,
      targetType: "comment",
      targetId: comment.id,
      text: `${user.nickname} 回复了你的评论。`,
      createdAt,
    });
    realtimeHub.broadcastToUsers([parentComment.authorId], {
      type: "notification.created",
      data: { notification },
      createdAt,
    });
  }

  if (post.authorId !== user.id && post.authorId !== parentComment?.authorId) {
    const notification = await postgresStore.createNotification({
      id: makeId("notif"),
      userId: post.authorId,
      type: "comment",
      actorUserId: user.id,
      targetType: "post",
      targetId: post.id,
      text: `${user.nickname} 评论了你的帖子。`,
      createdAt,
    });
    realtimeHub.broadcastToUsers([post.authorId], {
      type: "notification.created",
      data: { notification },
      createdAt,
    });
  }

  sendSuccess(res, { comment }, 201);
});

postsRouter.patch("/comments/:commentId", async (req, res) => {
  const comment = await postgresStore.findComment(req.params.commentId);
  if (!comment) {
    sendFailure(res, 404, "COMMENT_NOT_FOUND", "Comment not found.");
    return;
  }

  const currentUser = await postgresStore.findUserById(getCurrentUserId(req));
  if (!currentUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  if (!canManageComment(currentUser, comment)) {
    sendFailure(res, 403, "FORBIDDEN", "Only the comment author or an admin can edit this comment.");
    return;
  }

  const body = req.body as Record<string, unknown>;
  const updatedComment = await postgresStore.updateComment(comment.id, {
    ...(optionalString(body.text) && body.text !== undefined ? { text: body.text.trim() } : {}),
  });
  if (updatedComment) {
    realtimeHub.broadcastAll({
      type: "community.comment.updated",
      data: { postId: comment.postId, comment: updatedComment },
      createdAt: updatedComment.updatedAt,
    });
  }
  sendSuccess(res, { comment: updatedComment });
});

postsRouter.delete("/comments/:commentId", async (req, res) => {
  const comment = await postgresStore.findComment(req.params.commentId);
  if (!comment) {
    sendFailure(res, 404, "COMMENT_NOT_FOUND", "Comment not found.");
    return;
  }

  const currentUser = await postgresStore.findUserById(getCurrentUserId(req));
  if (!currentUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  if (!canManageComment(currentUser, comment)) {
    sendFailure(res, 403, "FORBIDDEN", "Only the comment author or an admin can delete this comment.");
    return;
  }

  await postgresStore.updateComment(comment.id, { status: "deleted" });
  const post = await postgresStore.findPost(comment.postId);
  const updatedPost = post ? await postgresStore.updatePost(post.id, { comments: Math.max(0, post.comments - 1) }) : undefined;
  realtimeHub.broadcastAll({
    type: "community.comment.deleted",
    data: { postId: comment.postId, commentId: comment.id, post: updatedPost },
    createdAt: new Date().toISOString(),
  });
  sendSuccess(res, { deleted: true, commentId: comment.id });
});

async function togglePostCounter(
  postId: string,
  userId: string,
  type: "like" | "favorite",
  enabled: boolean,
  res: Parameters<typeof sendSuccess>[0]
) {
  const post = await postgresStore.findPublishedPost(postId);
  if (!post) {
    sendFailure(res, 404, "POST_NOT_FOUND", "Post not found.");
    return;
  }

  const currentUser = await postgresStore.findUserById(userId);
  if (!currentUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  const updatedPost =
    type === "like"
      ? await postgresStore.setPostLike(currentUser.id, post.id, enabled)
      : await postgresStore.setPostFavorite(currentUser.id, post.id, enabled);

  if (updatedPost) {
    realtimeHub.broadcastAll({
      type: "community.post.updated",
      data: { post: updatedPost },
      createdAt: updatedPost.updatedAt,
    });
  }

  if (enabled && post.authorId !== currentUser.id) {
    const notification = await postgresStore.createNotification({
      id: makeId("notif"),
      userId: post.authorId,
      type,
      actorUserId: currentUser.id,
      targetType: "post",
      targetId: post.id,
      text: `${currentUser.nickname}${type === "like" ? "赞了" : "收藏了"}你的帖子。`,
      createdAt: timestamp(),
    });
    realtimeHub.broadcastToUsers([post.authorId], {
      type: "notification.created",
      data: { notification },
      createdAt: notification?.createdAt,
    });
  }

  sendSuccess(res, { post: updatedPost, [type === "like" ? "liked" : "favorited"]: enabled });
}

function canManagePost(user: { id: string; role?: string }, post: CommunityPost) {
  return user.role === "admin" || post.authorId === user.id;
}

function canManageComment(user: { id: string; role?: string }, comment: CommunityComment) {
  return user.role === "admin" || comment.authorId === user.id;
}

function sanitizeMediaUrls(value: unknown, fallback: unknown, mediaType: CommunityPost["mediaType"]) {
  if (mediaType === "text") return [];

  const urls = Array.isArray(value)
    ? value
    : typeof fallback === "string" && fallback.trim()
      ? [fallback]
      : [];
  const sanitized = urls
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return mediaType === "video" ? sanitized.slice(0, 1) : sanitized.slice(0, 12);
}
