import { Router } from "express";
import { sendFailure, sendSuccess } from "../common/http.js";
import { getCurrentUserId, numberValue, optionalString, requiredString, stringArray } from "../common/request.js";
import { postgresStore } from "../data/postgres.js";
import { makeId } from "../data/store.js";
import { realtimeHub } from "../realtime.js";

export const mealCardsRouter = Router();

mealCardsRouter.get("/", async (_req, res) => {
  const cards = await postgresStore.listActiveMealCards();
  sendSuccess(res, { cards });
});

mealCardsRouter.post("/", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const currentUserId = getCurrentUserId(req);
  const user = await postgresStore.findUserById(currentUserId);

  if (!user) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  if (
    !requiredString(body.text) ||
    !requiredString(body.time) ||
    !requiredString(body.place) ||
    !requiredString(body.people) ||
    !stringArray(body.tags)
  ) {
    sendFailure(res, 400, "INVALID_MEAL_CARD", "text, time, place, people, and tags are required.");
    return;
  }

  const card = await postgresStore.createMealCard({
    id: optionalString(body.id) && body.id?.trim() ? body.id.trim() : makeId("card"),
    userId: user.id,
    nickname: user.nickname,
    avatarText: user.avatarText,
    verified: user.verified,
    text: body.text.trim(),
    time: body.time.trim(),
    place: body.place.trim(),
    people: body.people.trim(),
    tags: body.tags.map((tag) => tag.trim()).filter(Boolean),
    matchScore: numberValue(body.matchScore) ? body.matchScore : 80,
    reason: optionalString(body.reason) && body.reason?.trim() ? body.reason.trim() : "Created from the prototype API.",
    mediaType: body.mediaType === "photo" || body.mediaType === "video" ? body.mediaType : undefined,
    mediaUrl: optionalString(body.mediaUrl) && body.mediaUrl?.trim() ? body.mediaUrl.trim() : undefined,
    mediaMimeType: optionalString(body.mediaMimeType) && body.mediaMimeType?.trim() ? body.mediaMimeType.trim() : undefined,
    createdAt: optionalString(body.createdAt) && body.createdAt ? body.createdAt : new Date().toISOString(),
    status: "active",
  });
  realtimeHub.broadcastAll({
    type: "meal-card.created",
    data: { card },
    createdAt: card.createdAt,
  });
  sendSuccess(res, card, 201);
});

mealCardsRouter.get("/:cardId", async (req, res) => {
  const card = await postgresStore.findMealCard(req.params.cardId);
  if (!card) {
    sendFailure(res, 404, "MEAL_CARD_NOT_FOUND", "Meal card not found.");
    return;
  }

  sendSuccess(res, { card });
});

mealCardsRouter.patch("/:cardId", async (req, res) => {
  const existingCard = await postgresStore.findMealCard(req.params.cardId);
  if (!existingCard) {
    sendFailure(res, 404, "MEAL_CARD_NOT_FOUND", "Meal card not found.");
    return;
  }

  const currentUser = await postgresStore.findUserById(getCurrentUserId(req));
  if (!currentUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  if (!canManageMealCard(currentUser, existingCard)) {
    sendFailure(res, 403, "FORBIDDEN", "Only the card owner or an admin can edit this meal card.");
    return;
  }

  const body = req.body as Record<string, unknown>;
  const card = await postgresStore.updateMealCard(existingCard.id, {
    ...(optionalString(body.text) && body.text !== undefined ? { text: body.text.trim() } : {}),
    ...(optionalString(body.time) && body.time !== undefined ? { time: body.time.trim() } : {}),
    ...(optionalString(body.place) && body.place !== undefined ? { place: body.place.trim() } : {}),
    ...(optionalString(body.people) && body.people !== undefined ? { people: body.people.trim() } : {}),
    ...(stringArray(body.tags) ? { tags: body.tags.map((tag) => tag.trim()).filter(Boolean) } : {}),
    ...(numberValue(body.matchScore) ? { matchScore: body.matchScore } : {}),
    ...(optionalString(body.reason) && body.reason !== undefined ? { reason: body.reason.trim() } : {}),
    ...(body.mediaType === "photo" || body.mediaType === "video" ? { mediaType: body.mediaType } : {}),
    ...(optionalString(body.mediaUrl) && body.mediaUrl !== undefined ? { mediaUrl: body.mediaUrl.trim() } : {}),
    ...(optionalString(body.mediaMimeType) && body.mediaMimeType !== undefined ? { mediaMimeType: body.mediaMimeType.trim() } : {}),
    ...(body.mediaType === null ? { mediaType: undefined } : {}),
    ...(body.mediaUrl === null ? { mediaUrl: undefined } : {}),
    ...(body.mediaMimeType === null ? { mediaMimeType: undefined } : {}),
    ...(body.status === "active" || body.status === "closed" || body.status === "deleted" ? { status: body.status } : {}),
  });

  if (card) {
    realtimeHub.broadcastAll({
      type: "meal-card.updated",
      data: { card },
      createdAt: card.updatedAt,
    });
  }

  sendSuccess(res, { card });
});

mealCardsRouter.delete("/:cardId", async (req, res) => {
  const existingCard = await postgresStore.findMealCard(req.params.cardId);
  if (!existingCard) {
    sendFailure(res, 404, "MEAL_CARD_NOT_FOUND", "Meal card not found.");
    return;
  }

  const currentUser = await postgresStore.findUserById(getCurrentUserId(req));
  if (!currentUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  if (!canManageMealCard(currentUser, existingCard)) {
    sendFailure(res, 403, "FORBIDDEN", "Only the card owner or an admin can delete this meal card.");
    return;
  }

  const card = await postgresStore.updateMealCard(existingCard.id, { status: "deleted" });
  realtimeHub.broadcastAll({
    type: "meal-card.deleted",
    data: { cardId: card?.id ?? existingCard.id },
    createdAt: new Date().toISOString(),
  });
  sendSuccess(res, { deleted: true, cardId: card?.id ?? existingCard.id });
});

mealCardsRouter.post("/:cardId/invite", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const targetCard = await postgresStore.findActiveMealCard(req.params.cardId);

  if (!targetCard) {
    sendFailure(res, 404, "MEAL_CARD_NOT_FOUND", "Meal card not found.");
    return;
  }

  const memberUserIds = Array.from(new Set([currentUserId, targetCard.userId]));
  let conversation = await postgresStore.findConversationForMembers(memberUserIds);

  if (!conversation) {
    conversation = await postgresStore.createConversation({
      id: makeId("conv"),
      memberUserIds,
      title: targetCard.nickname,
      preview: "Meal invite created.",
    });
  }

  const createdAt = new Date().toISOString();
  const request = await postgresStore.createExchangeRequest({
    id: makeId("exchange"),
    senderUserId: currentUserId,
    receiverUserId: targetCard.userId,
    targetCardId: targetCard.id,
    conversationId: conversation.id,
    status: "pending" as const,
    createdAt,
    updatedAt: createdAt,
  });

  const message = await postgresStore.createMessage({
    id: makeId("msg"),
    conversationId: conversation.id,
    senderUserId: currentUserId,
    type: "meal-card-exchange",
    text: "Meal invite sent.",
    metadata: { exchangeRequestId: request.id, targetCardId: targetCard.id },
    createdAt,
  });

  const notification = await postgresStore.createNotification({
    id: makeId("notif"),
    userId: targetCard.userId,
    type: "message",
    actorUserId: currentUserId,
    targetType: "conversation",
    targetId: conversation.id,
    text: "You received a meal invite.",
    createdAt: message.createdAt,
  });

  realtimeHub.broadcastToUsers(memberUserIds, {
    type: "chat.exchange.created",
    data: {
      conversationId: conversation.id,
      request,
      message,
    },
    createdAt,
  });

  realtimeHub.broadcastToUsers([targetCard.userId], {
    type: "notification.created",
    data: { notification },
    createdAt: message.createdAt,
  });

  sendSuccess(res, { request, conversation: await postgresStore.findConversation(conversation.id) }, 201);
});

function canManageMealCard(user: { id: string; role?: string }, card: { userId: string }) {
  return user.role === "admin" || card.userId === user.id;
}
