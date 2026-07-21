import { Router } from "express";
import { sendFailure, sendSuccess, toPublicUser } from "../common/http.js";
import { getCurrentUserId, optionalString, stringArray } from "../common/request.js";
import { postgresStore } from "../data/postgres.js";
import { makeId, timestamp } from "../data/store.js";
import { realtimeHub } from "../realtime.js";
import { queueUserAiProfileRefresh } from "./aiMemory.js";
import { queueUserMealCardRecommendationCacheRefresh } from "./mealCardRecommendationFeatures.js";
import { recordMealCardRecommendationEvent } from "./recommendationFeedback.js";

export const usersRouter = Router();

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function sanitizePetIntro(value: unknown) {
  return readString(value).trim().slice(0, 50);
}

function sanitizePetName(value: unknown) {
  return readString(value).trim().slice(0, 16);
}

function sanitizePublicAnimatedPet(value: unknown) {
  const animatedPet = readRecord(value);
  const stickers = Array.isArray(animatedPet.stickers) ? animatedPet.stickers : [];

  return {
    stickers: stickers.slice(0, 4).map((rawSticker) => {
      const sticker = readRecord(rawSticker);
      return {
        id: readString(sticker.id),
        sourceTag: readString(sticker.sourceTag) || undefined,
        slot: readString(sticker.slot) || undefined,
        src: readString(sticker.src) || undefined,
        x: readNumber(sticker.x, 0.5, 0, 1),
        y: readNumber(sticker.y, 0.5, 0, 1),
        scale: readNumber(sticker.scale, 0.22, 0.08, 0.48),
        rotate: readNumber(sticker.rotate, 0, -180, 180),
      };
    }).filter((sticker) => sticker.id),
  };
}

function sanitizePublicAvatarPet(value: unknown) {
  const avatarPet = readRecord(value);
  const eyeAnchors = readRecord(avatarPet.eyeAnchors);
  const leftEye = readRecord(eyeAnchors.left);
  const rightEye = readRecord(eyeAnchors.right);
  const stickers = Array.isArray(avatarPet.stickers) ? avatarPet.stickers : [];

  return {
    baseId: readString(avatarPet.baseId, "q-avatar-big-head-03"),
    customAvatarUrl: typeof avatarPet.customAvatarUrl === "string" ? avatarPet.customAvatarUrl : null,
    hairColor: readString(avatarPet.hairColor, "#b79af2"),
    eyeColor: readString(avatarPet.eyeColor, "#7c3aed"),
    eyeAnchors: {
      left: { x: readNumber(leftEye.x, 0.38, 0, 1), y: readNumber(leftEye.y, 0.48, 0, 1) },
      right: { x: readNumber(rightEye.x, 0.62, 0, 1), y: readNumber(rightEye.y, 0.48, 0, 1) },
    },
    stickers: stickers.slice(0, 4).map((rawSticker) => {
      const sticker = readRecord(rawSticker);
      return {
        id: readString(sticker.id),
        sourceTag: readString(sticker.sourceTag) || undefined,
        slot: readString(sticker.slot) || undefined,
        src: readString(sticker.src) || undefined,
        x: readNumber(sticker.x, 0.5, 0, 1),
        y: readNumber(sticker.y, 0.5, 0, 1),
        scale: readNumber(sticker.scale, 0.22, 0.08, 0.48),
        rotate: readNumber(sticker.rotate, 0, -180, 180),
      };
    }).filter((sticker) => sticker.id),
  };
}

function toPublicPetSummary(userId: string, ownerNickname: string, petState: { state: Record<string, unknown>; updatedAt: string }) {
  const state = readRecord(petState.state);
  if (state.visible !== true) return null;
  const petName = sanitizePetName(state.petName) || `${ownerNickname}的桌宠`;

  return {
    userId,
    visible: true,
    petStyle: state.petStyle === "avatar-static" ? "avatar-static" : "animated-vpet",
    animatedPet: sanitizePublicAnimatedPet(state.animatedPet),
    avatarPet: sanitizePublicAvatarPet(state.avatarPet),
    petName,
    level: Math.max(1, Math.round(readNumber(state.level, 1, 1, 999))),
    mood: Math.round(readNumber(state.mood, 76, 0, 100)),
    intro: sanitizePetIntro(state.petIntro),
    updatedAt: petState.updatedAt,
  };
}

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

  const [follow, block] = await Promise.all([
    postgresStore.getFollowSummary(currentUserId, user.id),
    currentUserId === user.id
      ? Promise.resolve({ blocked: false, blockedBy: false, blockedEither: false })
      : postgresStore.getBlockSummary(currentUserId, user.id),
  ]);
  sendSuccess(res, { user: toPublicUser(user), follow, block });
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
  queueUserAiProfileRefresh(user.id);
  queueUserMealCardRecommendationCacheRefresh(user.id);

  sendSuccess(res, { user: toPublicUser(updatedUser!) });
});

usersRouter.delete("/me", async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await postgresStore.findUserById(userId);

  if (!user) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  await postgresStore.deleteUserAccount(user.id);
  realtimeHub.broadcastAll({
    type: "user.account.deleted",
    data: { userId: user.id },
    createdAt: new Date().toISOString(),
  });
  sendSuccess(res, { deleted: true, userId: user.id });
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

usersRouter.get("/me/blocks", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const blockedUsers = await postgresStore.listBlockedUsersFor(currentUserId);
  sendSuccess(res, {
    users: blockedUsers.map((entry) => ({
      ...toPublicUser(entry.user),
      blockedAt: entry.blockedAt,
    })),
  });
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

usersRouter.get("/:userId/pet-public", async (req, res) => {
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

  if (await isBlockedBetween(currentUserId, user.id)) {
    sendSuccess(res, { pet: null });
    return;
  }

  const petState = await postgresStore.getUserPetState(user.id);
  sendSuccess(res, { pet: toPublicPetSummary(user.id, user.nickname, petState) });
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

  const nextState = { ...(body as Record<string, unknown>) };
  nextState.petName = sanitizePetName(nextState.petName);
  nextState.petIntro = sanitizePetIntro(nextState.petIntro);
  const petState = await postgresStore.updateUserPetState(user.id, nextState);
  realtimeHub.broadcastAll({
    type: "user.pet.updated",
    data: { userId: user.id, pet: toPublicPetSummary(user.id, user.nickname, petState) },
    createdAt: new Date().toISOString(),
  });
  sendSuccess(res, petState);
});

usersRouter.get("/:userId/meal-cards", async (req, res) => {
  if (await isBlockedBetween(getCurrentUserId(req), req.params.userId)) {
    sendSuccess(res, { cards: [] });
    return;
  }
  const cards = await postgresStore.listMealCardsByUser(req.params.userId);
  sendSuccess(res, { cards });
});

usersRouter.get("/:userId/posts", async (req, res) => {
  if (await isBlockedBetween(getCurrentUserId(req), req.params.userId)) {
    sendSuccess(res, { posts: [] });
    return;
  }
  const posts = await postgresStore.listPostsByUser(req.params.userId);
  sendSuccess(res, { posts });
});

usersRouter.get("/:userId/following", async (req, res) => {
  if (await isBlockedBetween(getCurrentUserId(req), req.params.userId)) {
    sendSuccess(res, { users: [] });
    return;
  }
  const users = await postgresStore.listFollowedUsers(req.params.userId);
  const hiddenIds = new Set(await postgresStore.listRelatedBlockedUserIdsFor(getCurrentUserId(req)));
  sendSuccess(res, { users: users.filter((user) => !hiddenIds.has(user.id)).map(toPublicUser) });
});

usersRouter.get("/:userId/followers", async (req, res) => {
  if (await isBlockedBetween(getCurrentUserId(req), req.params.userId)) {
    sendSuccess(res, { users: [] });
    return;
  }
  const users = await postgresStore.listFollowers(req.params.userId);
  const hiddenIds = new Set(await postgresStore.listRelatedBlockedUserIdsFor(getCurrentUserId(req)));
  sendSuccess(res, { users: users.filter((user) => !hiddenIds.has(user.id)).map(toPublicUser) });
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
  if (await isBlockedBetween(currentUserId, targetUser.id)) {
    sendFailure(res, 403, "USER_BLOCKED", "你们之间存在屏蔽关系，不能关注。");
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
  if (currentUser.id === targetUser.id) {
    sendFailure(res, 400, "INVALID_BLOCK_TARGET", "不能屏蔽自己。");
    return;
  }

  await postgresStore.setBlock(currentUser.id, targetUser.id, true);
  const [follow, block] = await Promise.all([
    postgresStore.getFollowSummary(currentUser.id, targetUser.id),
    postgresStore.getBlockSummary(currentUser.id, targetUser.id),
  ]);
  recordMealCardRecommendationEvent({
    userId: currentUser.id,
    authorUserId: targetUser.id,
    eventType: "block",
    context: { targetUserId: targetUser.id },
  });
  realtimeHub.broadcastToUsers([currentUser.id], {
    type: "user.block.updated",
    data: { blockerUserId: currentUser.id, blockedUserId: targetUser.id, blocked: true, follow, block },
    createdAt: new Date().toISOString(),
  });
  sendSuccess(res, { blocked: true, userId: targetUser.id, follow, block });
});

usersRouter.delete("/:userId/block", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const targetUser = await postgresStore.findUserById(req.params.userId);
  if (!targetUser) {
    sendFailure(res, 404, "USER_NOT_FOUND", "User not found.");
    return;
  }
  await postgresStore.setBlock(currentUserId, targetUser.id, false);
  const block = await postgresStore.getBlockSummary(currentUserId, targetUser.id);
  realtimeHub.broadcastToUsers([currentUserId], {
    type: "user.block.updated",
    data: { blockerUserId: currentUserId, blockedUserId: targetUser.id, blocked: false, block },
    createdAt: new Date().toISOString(),
  });
  sendSuccess(res, { blocked: false, userId: targetUser.id, block });
});

async function isBlockedBetween(currentUserId: string, targetUserId: string) {
  if (currentUserId === targetUserId) return false;
  return (await postgresStore.getBlockSummary(currentUserId, targetUserId)).blockedEither;
}
