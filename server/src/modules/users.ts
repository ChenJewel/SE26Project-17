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

  if (currentUserId !== user.id) {
    const settings = await postgresStore.getUserSettings(user.id);
    if (settings.settings.profileVisible === false) {
      sendFailure(res, 403, "PROFILE_NOT_VISIBLE", "This profile is not visible.");
      return;
    }
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
    ...(typeof body.avatarUrl === "string" ? { avatarUrl: body.avatarUrl.trim() || undefined } : {}),
    ...(optionalString(body.school) && body.school !== undefined ? { school: body.school.trim() } : {}),
    ...(optionalString(body.bio) ? { bio: body.bio?.trim() } : {}),
    ...(stringArray(body.preferenceTags) ? { preferenceTags: body.preferenceTags.map((tag) => tag.trim()).filter(Boolean) } : {}),
    ...(typeof body.profileCompleted === "boolean" ? { profileCompleted: body.profileCompleted } : {}),
  });

  realtimeHub.broadcastAll({
    type: "user.profile.updated",
    data: { user: toPublicUser(updatedUser!) },
    createdAt: new Date().toISOString(),
  });

  sendSuccess(res, { user: toPublicUser(updatedUser!) });
});

usersRouter.get("/me/settings", async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await postgresStore.findUserById(userId);

  if (!user) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  const settings = await postgresStore.getUserSettings(user.id);
  sendSuccess(res, settings);
});

usersRouter.patch("/me/settings", async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await postgresStore.findUserById(userId);

  if (!user) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  const body = req.body as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    sendFailure(res, 400, "INVALID_SETTINGS", "Settings payload must be an object.");
    return;
  }

  const settings = await postgresStore.updateUserSettings(user.id, body as Record<string, unknown>);
  sendSuccess(res, settings);
});

usersRouter.get("/me/pet", async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await postgresStore.findUserById(userId);

  if (!user) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  const petState = await postgresStore.getUserPetState(user.id);
  sendSuccess(res, petState);
});

usersRouter.patch("/me/pet", async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await postgresStore.findUserById(userId);

  if (!user) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  const body = req.body as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    sendFailure(res, 400, "INVALID_PET_STATE", "Pet state payload must be an object.");
    return;
  }

  const petState = await postgresStore.updateUserPetState(user.id, body as Record<string, unknown>);
  sendSuccess(res, petState);
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
  realtimeHub.broadcastAll({
    type: "user.follow.updated",
    data: {
      followerUserId: currentUser.id,
      followingUserId: targetUser.id,
      following: true,
    },
    createdAt,
  });

  sendSuccess(res, { following: true, userId: targetUser.id, follow });
});

usersRouter.delete("/:userId/follow", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  await postgresStore.setFollow(currentUserId, req.params.userId, false);
  const follow = await postgresStore.getFollowSummary(currentUserId, req.params.userId);
  realtimeHub.broadcastAll({
    type: "user.follow.updated",
    data: {
      followerUserId: currentUserId,
      followingUserId: req.params.userId,
      following: false,
    },
    createdAt: new Date().toISOString(),
  });
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
