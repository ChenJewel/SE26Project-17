import { Router } from "express";
import { sendFailure, sendSuccess } from "../common/http.js";
import { getCurrentUserId, optionalString } from "../common/request.js";
import { postgresStore } from "../data/postgres.js";
import { makeId, timestamp } from "../data/store.js";
import { realtimeHub } from "../realtime.js";
import { queueUserAiProfileRefresh } from "./aiMemory.js";

export const commentsRouter = Router();

commentsRouter.patch("/:commentId", async (req, res) => {
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
    queueUserAiProfileRefresh(updatedComment.authorId);
  }
  sendSuccess(res, { comment: updatedComment });
});

commentsRouter.delete("/:commentId", async (req, res) => {
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
  queueUserAiProfileRefresh(comment.authorId);
  sendSuccess(res, { deleted: true, commentId: comment.id });
});

commentsRouter.post("/:commentId/like", async (req, res) => {
  await toggleCommentCounter(req.params.commentId, getCurrentUserId(req), "like", true, res);
});

commentsRouter.delete("/:commentId/like", async (req, res) => {
  await toggleCommentCounter(req.params.commentId, getCurrentUserId(req), "like", false, res);
});

commentsRouter.post("/:commentId/favorite", async (req, res) => {
  await toggleCommentCounter(req.params.commentId, getCurrentUserId(req), "favorite", true, res);
});

commentsRouter.delete("/:commentId/favorite", async (req, res) => {
  await toggleCommentCounter(req.params.commentId, getCurrentUserId(req), "favorite", false, res);
});

async function toggleCommentCounter(
  commentId: string,
  userId: string,
  type: "like" | "favorite",
  enabled: boolean,
  res: Parameters<typeof sendSuccess>[0]
) {
  const [comment, currentUser] = await Promise.all([
    postgresStore.findComment(commentId),
    postgresStore.findUserById(userId),
  ]);

  if (!comment) {
    sendFailure(res, 404, "COMMENT_NOT_FOUND", "Comment not found.");
    return;
  }

  if (!currentUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  const updatedComment =
    type === "like"
      ? await postgresStore.setCommentLike(currentUser.id, comment.id, enabled)
      : await postgresStore.setCommentFavorite(currentUser.id, comment.id, enabled);

  if (updatedComment) {
    realtimeHub.broadcastAll({
      type: "community.comment.updated",
      data: { postId: comment.postId, comment: updatedComment },
      createdAt: updatedComment.updatedAt,
    });
  }

  if (enabled && comment.authorId !== currentUser.id) {
    const notification = await postgresStore.createNotification({
      id: makeId("notif"),
      userId: comment.authorId,
      type,
      actorUserId: currentUser.id,
      targetType: "comment",
      targetId: comment.id,
      text: `${currentUser.nickname}${type === "like" ? "赞了" : "收藏了"}你的评论。`,
      createdAt: timestamp(),
    });
    realtimeHub.broadcastToUsers([comment.authorId], {
      type: "notification.created",
      data: { notification },
      createdAt: notification?.createdAt,
    });
  }

  sendSuccess(res, { comment: updatedComment, [type === "like" ? "liked" : "favorited"]: enabled });
}

function canManageComment(user: { id: string; role?: string }, comment: { authorId: string }) {
  return user.role === "admin" || comment.authorId === user.id;
}
