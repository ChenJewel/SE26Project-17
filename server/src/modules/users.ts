import { Router } from "express";
import { sendFailure, sendSuccess, toPublicUser } from "../common/http.js";
import { getCurrentUserId, optionalString, stringArray } from "../common/request.js";
import { postgresStore } from "../data/postgres.js";
import { makeId, timestamp } from "../data/store.js";
import { realtimeHub } from "../realtime.js";

export const usersRouter = Router();

usersRouter.get("/me/profile", async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await postgresStore.findUserById(userId);

  if (!user) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  const [cards, posts, followedUsers, followers, likedPosts, favoritePosts, comments, likedComments, favoriteComments, interactions, follow] = await Promise.all([
    postgresStore.listMealCardsByUser(user.id),
    postgresStore.listPostsByUser(user.id),
    postgresStore.listFollowedUsers(user.id),
    postgresStore.listFollowers(user.id),
    postgresStore.listLikedPostsByUser(user.id),
    postgresStore.listFavoritePostsByUser(user.id),
    postgresStore.listCommentsByUser(user.id),
    postgresStore.listLikedCommentsByUser(user.id),
    postgresStore.listFavoriteCommentsByUser(user.id),
    postgresStore.getInteractionIds(user.id),
    postgresStore.getFollowSummary(user.id, user.id),
  ]);

  sendSuccess(res, {
    user: toPublicUser(user),
    cards,
    posts,
    followedUsers: followedUsers.map(toPublicUser),
    followers: followers.map(toPublicUser),
    likedPosts,
    favoritePosts,
    comments,
    likedComments,
    favoriteComments,
    interactions,
    stats: {
      followerCount: follow.followerCount,
      followingCount: follow.followingCount,
      postCount: posts.length,
      cardCount: cards.length,
      commentCount: comments.length,
      likedPostCount: likedPosts.length,
      favoritePostCount: favoritePosts.length,
    },
  });
});

usersRouter.get("/:userId", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const user = await postgresStore.findUserById(req.params.userId);
  if (!user) {
    sendFailure(res, 404, "USER_NOT_FOUND", "User not found.");
    return;
  }

  const follow = await postgresStore.getFollowSummary(currentUserId, user.id);
  sendSuccess(res, { user: toPublicUser(user), follow });
});

usersRouter.patch("/me", async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await postgresStore.findUserById(userId);

  if (!user) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  const body = req.body as Record<string, unknown>;
  const updatedUser = await postgresStore.updateUser(user.id, {
    ...(optionalString(body.nickname) && body.nickname !== undefined ? { nickname: body.nickname.trim() } : {}),
    ...(optionalString(body.avatarText) && body.avatarText !== undefined ? { avatarText: body.avatarText.trim() } : {}),
    ...(optionalString(body.avatarUrl) && body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl.trim() } : {}),
    ...(optionalString(body.school) && body.school !== undefined ? { school: body.school.trim() } : {}),
    ...(optionalString(body.bio) ? { bio: body.bio?.trim() } : {}),
    ...(stringArray(body.preferenceTags) ? { preferenceTags: body.preferenceTags.map((tag) => tag.trim()).filter(Boolean) } : {}),
  });

  sendSuccess(res, { user: toPublicUser(updatedUser!) });
});

usersRouter.get("/:userId/meal-cards", async (req, res) => {
  const cards = await postgresStore.listMealCardsByUser(req.params.userId);
  sendSuccess(res, { cards });
});

usersRouter.get("/:userId/posts", async (req, res) => {
  const posts = await postgresStore.listPostsByUser(req.params.userId);
  sendSuccess(res, { posts });
});

usersRouter.get("/:userId/following", async (req, res) => {
  const users = await postgresStore.listFollowedUsers(req.params.userId);
  sendSuccess(res, { users: users.map(toPublicUser) });
});

usersRouter.get("/:userId/followers", async (req, res) => {
  const users = await postgresStore.listFollowers(req.params.userId);
  sendSuccess(res, { users: users.map(toPublicUser) });
});

usersRouter.get("/:userId/follow-summary", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const targetUser = await postgresStore.findUserById(req.params.userId);
  if (!targetUser) {
    sendFailure(res, 404, "USER_NOT_FOUND", "User not found.");
    return;
  }

  const follow = await postgresStore.getFollowSummary(currentUserId, targetUser.id);
  sendSuccess(res, { userId: targetUser.id, follow });
});

usersRouter.post("/:userId/follow", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const currentUser = await postgresStore.findUserById(currentUserId);
  const targetUser = await postgresStore.findUserById(req.params.userId);

  if (!currentUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }
  if (!targetUser) {
    sendFailure(res, 404, "USER_NOT_FOUND", "User not found.");
    return;
  }

  await postgresStore.setFollow(currentUser.id, targetUser.id, true);
  const follow = await postgresStore.getFollowSummary(currentUser.id, targetUser.id);
  const createdAt = timestamp();
  const notification = await postgresStore.createNotification({
    id: makeId("notif"),
    userId: targetUser.id,
    type: "follow",
    actorUserId: currentUser.id,
    targetType: "user",
    targetId: currentUser.id,
    text: `${currentUser.nickname} followed you.`,
    createdAt,
  });

  realtimeHub.broadcastToUsers([targetUser.id], {
    type: "notification.created",
    data: { notification },
    createdAt,
  });

  sendSuccess(res, { following: true, userId: targetUser.id, follow });
});

usersRouter.delete("/:userId/follow", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  await postgresStore.setFollow(currentUserId, req.params.userId, false);
  const follow = await postgresStore.getFollowSummary(currentUserId, req.params.userId);
  sendSuccess(res, { following: false, userId: req.params.userId, follow });
});

usersRouter.post("/:userId/block", async (req, res) => {
  await postgresStore.setBlock(getCurrentUserId(req), req.params.userId, true);
  sendSuccess(res, { blocked: true, userId: req.params.userId });
});

usersRouter.delete("/:userId/block", async (req, res) => {
  await postgresStore.setBlock(getCurrentUserId(req), req.params.userId, false);
  sendSuccess(res, { blocked: false, userId: req.params.userId });
});
