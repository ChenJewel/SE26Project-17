import { Router } from "express";
import { sendFailure, sendSuccess } from "../common/http.js";
import { getCurrentUserId, optionalString, requiredString, stringArray } from "../common/request.js";
import { postgresStore } from "../data/postgres.js";
import { makeId } from "../data/store.js";
import { realtimeHub } from "../realtime.js";

export const chatRouter = Router();
const strangerMessageLimit = 3;
const strangerMessageWindowMs = 24 * 60 * 60 * 1000;

chatRouter.get("/conversations", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const conversations = await Promise.all(
    (await postgresStore.listConversationsForUser(currentUserId)).map((conversation) =>
      toConversationResponse(conversation, currentUserId)
    )
  );
  sendSuccess(res, { conversations });
});

chatRouter.post("/conversations", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const body = req.body as Record<string, unknown>;

  if (!stringArray(body.memberUserIds)) {
    sendFailure(res, 400, "INVALID_CONVERSATION", "memberUserIds is required.");
    return;
  }

  const memberUserIds = Array.from(new Set([currentUserId, ...body.memberUserIds]));
  const users = await Promise.all(memberUserIds.map((userId) => postgresStore.findUserById(userId)));
  const missingUserId = memberUserIds.find((_, index) => !users[index]);
  if (missingUserId) {
    sendFailure(res, 404, "USER_NOT_FOUND", "One or more conversation members were not found.");
    return;
  }

  const existingConversation = await postgresStore.findConversationForMembers(memberUserIds);
  if (existingConversation) {
    sendSuccess(res, { conversation: await toConversationResponse(existingConversation, currentUserId) });
    return;
  }

  const conversation = await postgresStore.createConversation({
    id: makeId("conv"),
    memberUserIds,
    title: requiredString(body.title) ? body.title.trim() : "约饭会话",
    preview: "",
  });

  sendSuccess(res, { conversation: await toConversationResponse(conversation, currentUserId) }, 201);
});

chatRouter.get("/groups", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
  const groups = await Promise.all(
    (await postgresStore.listPublicGroupConversations(query, category, 50)).map((conversation) =>
      toConversationResponse(conversation, currentUserId)
    )
  );
  sendSuccess(res, { groups });
});

chatRouter.post("/groups", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const currentUser = await postgresStore.findUserById(currentUserId);
  const body = req.body as Record<string, unknown>;

  if (!currentUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  if (!requiredString(body.title) || !requiredString(body.description)) {
    sendFailure(res, 400, "INVALID_GROUP", "title and description are required.");
    return;
  }

  const invitedUserIds = stringArray(body.memberUserIds) ? body.memberUserIds : [];
  const memberUserIds = Array.from(new Set([currentUserId, ...invitedUserIds]));
  const users = await Promise.all(memberUserIds.map((userId) => postgresStore.findUserById(userId)));
  const missingUserId = memberUserIds.find((_, index) => !users[index]);
  if (missingUserId) {
    sendFailure(res, 404, "USER_NOT_FOUND", "One or more group members were not found.");
    return;
  }

  const title = body.title.trim().slice(0, 24);
  const description = body.description.trim().slice(0, 140);
  const conversation = await postgresStore.createConversation({
    id: makeId("conv"),
    memberUserIds,
    title,
    preview: `${currentUser.nickname} 创建了群聊。`,
    conversationType: "group",
    avatarText: title.slice(0, 2),
    description,
    category: optionalString(body.category) && body.category?.trim() ? body.category.trim().slice(0, 20) : "聊天交友",
    location: optionalString(body.location) && body.location?.trim() ? body.location.trim().slice(0, 40) : undefined,
    joinQuestion: optionalString(body.joinQuestion) && body.joinQuestion?.trim() ? body.joinQuestion.trim().slice(0, 80) : undefined,
    isPublic: body.isPublic !== false,
    ownerUserId: currentUserId,
  });

  const message = await postgresStore.createMessage({
    id: makeId("msg"),
    conversationId: conversation.id,
    senderUserId: currentUserId,
    type: "system",
    text: `${currentUser.nickname} 创建了群聊「${title}」。`,
  });

  realtimeHub.broadcastToUsers(conversation.memberUserIds, {
    type: "chat.group.created",
    data: { conversation: await toConversationResponse(conversation, currentUserId), message },
    createdAt: message.createdAt,
  });

  sendSuccess(res, { conversation: await toConversationResponse(await postgresStore.findConversation(conversation.id), currentUserId) }, 201);
});

chatRouter.post("/groups/:conversationId/join", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const currentUser = await postgresStore.findUserById(currentUserId);
  const conversation = await postgresStore.findConversation(req.params.conversationId);

  if (!currentUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  if (!conversation || conversation.conversationType !== "group" || !conversation.isPublic) {
    sendFailure(res, 404, "GROUP_NOT_FOUND", "Public group not found.");
    return;
  }

  if (!(await postgresStore.isConversationMember(conversation.id, currentUserId))) {
    await postgresStore.addConversationMember(conversation.id, currentUserId);
    const message = await postgresStore.createMessage({
      id: makeId("msg"),
      conversationId: conversation.id,
      senderUserId: currentUserId,
      type: "system",
      text: `${currentUser.nickname} 加入了群聊。`,
    });
    const updatedConversation = await postgresStore.findConversation(conversation.id);
    if (updatedConversation) {
      realtimeHub.broadcastToUsers(updatedConversation.memberUserIds, {
        type: "chat.group.joined",
        data: {
          conversation: await toConversationResponse(updatedConversation, currentUserId),
          userId: currentUserId,
          message,
        },
        createdAt: message.createdAt,
      });
    }
  }

  sendSuccess(res, { conversation: await toConversationResponse(await postgresStore.findConversation(conversation.id), currentUserId) });
});

chatRouter.post("/groups/:conversationId/leave", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const currentUser = await postgresStore.findUserById(currentUserId);
  const conversation = await postgresStore.findConversation(req.params.conversationId);

  if (!currentUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  if (!conversation || conversation.conversationType !== "group" || !(await postgresStore.isConversationMember(conversation.id, currentUserId))) {
    sendFailure(res, 404, "GROUP_NOT_FOUND", "Group conversation not found.");
    return;
  }

  const updatedConversation = await postgresStore.removeConversationMember(conversation.id, currentUserId);
  let message: Awaited<ReturnType<typeof postgresStore.createMessage>> | undefined;
  if (updatedConversation && updatedConversation.memberUserIds.length > 0) {
    message = await postgresStore.createMessage({
      id: makeId("msg"),
      conversationId: conversation.id,
      senderUserId: currentUserId,
      type: "system",
      text: `${currentUser.nickname} left the group.`,
    });
  }

  const notifyUserIds = Array.from(new Set([currentUserId, ...(updatedConversation?.memberUserIds ?? [])]));
  realtimeHub.broadcastToUsers(notifyUserIds, {
    type: "chat.group.left",
    data: {
      conversationId: conversation.id,
      userId: currentUserId,
      conversation: updatedConversation ? await toConversationResponse(updatedConversation, currentUserId) : undefined,
      message,
    },
    createdAt: message?.createdAt ?? new Date().toISOString(),
  });

  sendSuccess(res, {
    left: true,
    conversationId: conversation.id,
    conversation: updatedConversation ? await toConversationResponse(updatedConversation, currentUserId) : undefined,
  });
});

chatRouter.patch("/groups/:conversationId", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const conversation = await postgresStore.findConversation(req.params.conversationId);

  if (!conversation || conversation.conversationType !== "group" || !(await postgresStore.isConversationMember(conversation.id, currentUserId))) {
    sendFailure(res, 404, "GROUP_NOT_FOUND", "Group conversation not found.");
    return;
  }

  if (conversation.ownerUserId && conversation.ownerUserId !== currentUserId) {
    sendFailure(res, 403, "GROUP_OWNER_REQUIRED", "Only the group owner can update group profile.");
    return;
  }

  const body = req.body as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 24) : "";
  const avatarText = typeof body.avatarText === "string" ? body.avatarText.trim().slice(0, 2) : "";
  const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : undefined;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 140) : undefined;
  const updated = await postgresStore.updateConversation(conversation.id, {
    ...(title ? { title } : {}),
    ...(avatarText ? { avatarText } : {}),
    ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || undefined } : {}),
    ...(description !== undefined ? { description } : {}),
  });

  if (!updated) {
    sendFailure(res, 404, "GROUP_NOT_FOUND", "Group conversation not found.");
    return;
  }

  const response = await toConversationResponse(updated, currentUserId);
  realtimeHub.broadcastToUsers(updated.memberUserIds, {
    type: "chat.group.updated",
    data: { conversation: response },
    createdAt: updated.updatedAt,
  });

  sendSuccess(res, { conversation: response });
});

chatRouter.get("/conversations/:conversationId/members", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const conversation = await postgresStore.findConversation(req.params.conversationId);
  if (!conversation || !(await postgresStore.isConversationMember(conversation.id, currentUserId))) {
    sendFailure(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    return;
  }

  const members = (await postgresStore.listConversationMemberUsers(conversation.id)).map((user) => ({
    id: user.id,
    nickname: user.nickname,
    avatarText: user.avatarText,
    avatarUrl: user.avatarUrl,
    verified: user.verified,
    school: user.school,
    role: user.id === conversation.ownerUserId ? "owner" : "member",
    online: realtimeHub.isUserOnline(user.id),
  }));

  sendSuccess(res, { members });
});

chatRouter.get("/conversations/:conversationId/messages", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const conversation = await postgresStore.findConversation(req.params.conversationId);
  if (!conversation || !(await postgresStore.isConversationMember(conversation.id, currentUserId))) {
    sendFailure(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    return;
  }

  const messages = await postgresStore.listMessages(conversation.id);
  const exchangeRequests = await postgresStore.listExchangeRequestsForConversation(conversation.id);
  const cardIds = Array.from(
    new Set(exchangeRequests.flatMap((request) => [request.targetCardId, request.ownCardId]).filter((id): id is string => Boolean(id)))
  );
  const cardPromises = cardIds.map((cardId) => postgresStore.findMealCard(cardId));
  const cards = (await Promise.all(cardPromises))
    .filter((card) => Boolean(card));
  await postgresStore.markConversationRead(conversation.id, currentUserId);
  realtimeHub.broadcastToUsers(conversation.memberUserIds, {
    type: "chat.conversation.read",
    data: {
      conversationId: conversation.id,
      userId: currentUserId,
      messageIds: messages.map((message) => message.id),
    },
    createdAt: new Date().toISOString(),
  });
  sendSuccess(res, { messages, exchangeRequests, cards });
});

chatRouter.post("/conversations/:conversationId/read", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const conversation = await postgresStore.findConversation(req.params.conversationId);
  if (!conversation || !(await postgresStore.isConversationMember(conversation.id, currentUserId))) {
    sendFailure(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    return;
  }

  const messages = await postgresStore.listMessages(conversation.id);
  const updatedConversation = await postgresStore.markConversationRead(conversation.id, currentUserId);
  realtimeHub.broadcastToUsers(conversation.memberUserIds, {
    type: "chat.conversation.read",
    data: {
      conversationId: conversation.id,
      userId: currentUserId,
      messageIds: messages.map((message) => message.id),
    },
    createdAt: new Date().toISOString(),
  });
  sendSuccess(res, { conversation: updatedConversation });
});

chatRouter.delete("/conversations/:conversationId/messages", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const conversation = await postgresStore.findConversation(req.params.conversationId);
  if (!conversation || !(await postgresStore.isConversationMember(conversation.id, currentUserId))) {
    sendFailure(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    return;
  }

  const body = req.body as Record<string, unknown>;
  const messageIds = Array.isArray(body.messageIds)
    ? Array.from(new Set(body.messageIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).map((id) => id.trim())))
    : [];
  if (!messageIds.length) {
    sendFailure(res, 400, "INVALID_MESSAGE_DELETE", "messageIds are required.");
    return;
  }

  const deletedCount = await postgresStore.deleteMessages(conversation.id, messageIds);
  const updatedConversation = await postgresStore.findConversation(conversation.id);
  realtimeHub.broadcastToUsers(conversation.memberUserIds, {
    type: "chat.messages.deleted",
    data: { conversationId: conversation.id, messageIds },
    createdAt: new Date().toISOString(),
  });
  sendSuccess(res, {
    deleted: true,
    deletedCount,
    messageIds,
    messages: await postgresStore.listMessages(conversation.id),
    conversation: await toConversationResponse(updatedConversation, currentUserId),
  });
});

chatRouter.delete("/conversations/:conversationId/messages/all", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const conversation = await postgresStore.findConversation(req.params.conversationId);
  if (!conversation || !(await postgresStore.isConversationMember(conversation.id, currentUserId))) {
    sendFailure(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    return;
  }

  const deletedCount = await postgresStore.deleteAllMessages(conversation.id);
  const updatedConversation = await postgresStore.findConversation(conversation.id);
  realtimeHub.broadcastToUsers(conversation.memberUserIds, {
    type: "chat.messages.cleared",
    data: { conversationId: conversation.id },
    createdAt: new Date().toISOString(),
  });
  sendSuccess(res, {
    deleted: true,
    deletedCount,
    messages: [],
    conversation: await toConversationResponse(updatedConversation, currentUserId),
  });
});

chatRouter.post("/messages", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const body = req.body as Record<string, unknown>;

  if (!requiredString(body.conversationId)) {
    sendFailure(res, 400, "INVALID_MESSAGE", "conversationId is required.");
    return;
  }

  const conversation = await postgresStore.findConversation(body.conversationId.trim());
  if (!conversation || !(await postgresStore.isConversationMember(conversation.id, currentUserId))) {
    sendFailure(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    return;
  }

  const type =
    body.type === "system" ||
    body.type === "meal-card-exchange" ||
    body.type === "image" ||
    body.type === "audio"
      ? body.type
      : "text";
  const text = requiredString(body.text)
    ? body.text.trim()
    : type === "image"
      ? "[Image]"
      : type === "audio"
        ? "[Voice]"
        : "";
  if (!text) {
    sendFailure(res, 400, "INVALID_MESSAGE", "text is required for text messages.");
    return;
  }

  const metadata = typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : {};
  const permission = await checkDirectMessagePermission(conversation, currentUserId, type, metadata);
  if (!permission.allowed) {
    sendFailure(res, 403, "STRANGER_MESSAGE_LIMIT", permission.message, {
      limit: strangerMessageLimit,
      remaining: 0,
      resetAt: permission.resetAt,
    });
    return;
  }

  const message = await postgresStore.createMessage({
    id: makeId("msg"),
    conversationId: conversation.id,
    senderUserId: currentUserId,
    type,
    text,
    metadata,
  });

  for (const userId of conversation.memberUserIds) {
    if (userId !== currentUserId) {
      const notification = await postgresStore.createNotification({
        id: makeId("notif"),
        userId,
        type: "message",
        actorUserId: currentUserId,
        targetType: "conversation",
        targetId: conversation.id,
        text: "你收到了一条新消息。",
        createdAt: message.createdAt,
      });
      realtimeHub.broadcastToUsers([userId], {
        type: "notification.created",
        data: { notification },
        createdAt: message.createdAt,
      });
    }
  }

  realtimeHub.broadcastToUsers(conversation.memberUserIds, {
    type: "chat.message.created",
    data: {
      conversationId: conversation.id,
      message,
    },
    createdAt: message.createdAt,
  });

  sendSuccess(res, { message }, 201);
});

chatRouter.post("/messages/:messageId/revoke", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const existing = await postgresStore.findMessage(req.params.messageId);
  if (!existing) {
    sendFailure(res, 404, "MESSAGE_NOT_FOUND", "Message not found.");
    return;
  }

  const conversation = await postgresStore.findConversation(existing.conversationId);
  if (!conversation || !(await postgresStore.isConversationMember(conversation.id, currentUserId))) {
    sendFailure(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    return;
  }

  if (existing.senderUserId !== currentUserId) {
    sendFailure(res, 403, "MESSAGE_NOT_OWNED", "Only the sender can revoke this message.");
    return;
  }

  const message = await postgresStore.revokeMessage(existing.id, currentUserId);
  realtimeHub.broadcastToUsers(conversation.memberUserIds, {
    type: "chat.message.revoked",
    data: { conversationId: conversation.id, message },
    createdAt: message?.revokedAt ?? new Date().toISOString(),
  });
  sendSuccess(res, { message });
});

chatRouter.post("/conversations/:conversationId/typing", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const conversation = await postgresStore.findConversation(req.params.conversationId);
  if (!conversation || !(await postgresStore.isConversationMember(conversation.id, currentUserId))) {
    sendFailure(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    return;
  }

  const body = req.body as Record<string, unknown>;
  const typing = body.typing !== false;
  realtimeHub.broadcastToUsers(
    conversation.memberUserIds.filter((userId) => userId !== currentUserId),
    {
      type: "chat.typing",
      data: { conversationId: conversation.id, userId: currentUserId, typing },
      createdAt: new Date().toISOString(),
    }
  );
  sendSuccess(res, { conversationId: conversation.id, typing });
});

chatRouter.post("/conversations/:conversationId/call-signal", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const conversation = await postgresStore.findConversation(req.params.conversationId);
  if (!conversation || !(await postgresStore.isConversationMember(conversation.id, currentUserId))) {
    sendFailure(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    return;
  }

  const body = req.body as Record<string, unknown>;
  if (!requiredString(body.callId)) {
    sendFailure(res, 400, "INVALID_CALL_SIGNAL", "callId is required.");
    return;
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!["offer", "answer", "ice", "hangup", "reject"].includes(action)) {
    sendFailure(res, 400, "INVALID_CALL_SIGNAL", "Unsupported call action.");
    return;
  }

  const payload = body.payload && typeof body.payload === "object" ? body.payload as Record<string, unknown> : {};
  realtimeHub.broadcastToUsers(
    conversation.memberUserIds.filter((userId) => userId !== currentUserId),
    {
      type: "chat.call.signal",
      data: {
        conversationId: conversation.id,
        callId: body.callId.trim(),
        fromUserId: currentUserId,
        action,
        payload,
      },
      createdAt: new Date().toISOString(),
    }
  );

  sendSuccess(res, { conversationId: conversation.id, callId: body.callId.trim(), action });
});

chatRouter.patch("/exchange-requests/:requestId", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const body = req.body as Record<string, unknown>;

  if (body.status !== "accepted" && body.status !== "rejected") {
    sendFailure(res, 400, "INVALID_EXCHANGE_STATUS", "status must be accepted or rejected.");
    return;
  }

  const existing = await postgresStore.findExchangeRequest(req.params.requestId);
  if (!existing || (existing.senderUserId !== currentUserId && existing.receiverUserId !== currentUserId)) {
    sendFailure(res, 404, "EXCHANGE_REQUEST_NOT_FOUND", "Exchange request not found.");
    return;
  }

  if (existing.receiverUserId !== currentUserId) {
    sendFailure(res, 403, "EXCHANGE_RECEIVER_REQUIRED", "Only the receiver can accept or reject this exchange request.");
    return;
  }

  const request = await postgresStore.updateExchangeRequestStatus(existing.id, body.status);
  const conversation = await postgresStore.findConversation(existing.conversationId);
  if (request && conversation) {
    realtimeHub.broadcastToUsers(conversation.memberUserIds, {
      type: "chat.exchange.updated",
      data: {
        conversationId: conversation.id,
        request,
      },
      createdAt: request.updatedAt,
    });
  }

  sendSuccess(res, { request });
});

async function toConversationResponse(
  conversation: Awaited<ReturnType<typeof postgresStore.findConversation>>,
  currentUserId: string
) {
  if (!conversation) return conversation;
  if (conversation.conversationType === "group") {
    return {
      ...conversation,
      group: true,
      memberCount: conversation.memberUserIds.length,
      joined: conversation.memberUserIds.includes(currentUserId),
      online: false,
    };
  }

  const otherUserId = conversation.memberUserIds.find((userId) => userId !== currentUserId);
  const otherUser = otherUserId ? await postgresStore.findUserById(otherUserId) : undefined;

  return otherUser && otherUserId
    ? {
        ...conversation,
        title: otherUser.nickname,
        otherUserId,
        avatarText: otherUser.avatarText,
        avatarUrl: otherUser.avatarUrl,
        online: realtimeHub.isUserOnline(otherUserId),
      }
    : { ...conversation, online: false };
}

async function checkDirectMessagePermission(
  conversation: NonNullable<Awaited<ReturnType<typeof postgresStore.findConversation>>>,
  currentUserId: string,
  type: "text" | "system" | "meal-card-exchange" | "image" | "audio",
  metadata: Record<string, unknown>
): Promise<{ allowed: true } | { allowed: false; message: string; resetAt: string }> {
  if (conversation.conversationType === "group" || conversation.memberUserIds.length !== 2) return { allowed: true };
  if (!countsTowardStrangerLimit(type, metadata)) return { allowed: true };

  const otherUserId = conversation.memberUserIds.find((userId) => userId !== currentUserId);
  if (!otherUserId) return { allowed: true };

  const follow = await postgresStore.getFollowSummary(currentUserId, otherUserId);
  if (follow.mutual) return { allowed: true };

  const [messages, exchangeRequests] = await Promise.all([
    postgresStore.listMessages(conversation.id),
    postgresStore.listExchangeRequestsForConversation(conversation.id),
  ]);

  if (exchangeRequests.some((request) => request.status === "accepted")) return { allowed: true };
  if (messages.some((message) => message.senderUserId === otherUserId && countsTowardStrangerLimit(message.type, message.metadata ?? {}))) return { allowed: true };

  const since = Date.now() - strangerMessageWindowMs;
  const countedMessages = messages
    .filter((message) => message.senderUserId === currentUserId)
    .filter((message) => Date.parse(message.createdAt) >= since)
    .filter((message) => countsTowardStrangerLimit(message.type, message.metadata ?? {}))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  if (countedMessages.length < strangerMessageLimit) return { allowed: true };

  const firstCountedAt = Date.parse(countedMessages[0].createdAt);
  const resetAt = new Date((Number.isFinite(firstCountedAt) ? firstCountedAt : Date.now()) + strangerMessageWindowMs).toISOString();
  return {
    allowed: false,
    resetAt,
    message: "你们还不是互相关注好友，对方回复你之前，24 小时内最多发送 3 条普通消息。",
  };
}

function countsTowardStrangerLimit(type: "text" | "system" | "meal-card-exchange" | "image" | "audio", metadata: Record<string, unknown>) {
  if (type === "system" || type === "meal-card-exchange") return false;
  if (metadata.postSnapshot || metadata.commentSnapshot) return false;
  return type === "text" || type === "image" || type === "audio";
}
