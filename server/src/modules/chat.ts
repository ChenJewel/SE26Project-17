import { Router, type Request, type RequestHandler, type Response } from "express";
import { sendFailure, sendSuccess } from "../common/http.js";
import { getCurrentUserId, optionalString, requiredString, stringArray } from "../common/request.js";
import { postgresStore } from "../data/postgres.js";
import { makeId } from "../data/store.js";
import { realtimeHub } from "../realtime.js";
import type { AiSuggestionMode, Message } from "../types.js";
import {
  buildAiSuggestionResponse,
  readAiSuggestionGovernanceStatus,
  readAiSuggestionJob,
  readAiSuggestionMode,
  updateAiSuggestionFeedback,
} from "./aiSuggestions.js";
import {
  markAiSuggestionAdvancedToMeal,
  markAiSuggestionRecipientReply,
  recordMealCardRecommendationEvent,
} from "./recommendationFeedback.js";

export const chatRouter = Router();
const strangerMessageLimit = 3;
const strangerMessageWindowMs = 24 * 60 * 60 * 1000;

const requireAdmin: RequestHandler = async (req, res, next) => {
  const user = await postgresStore.findUserById(getCurrentUserId(req));
  if (!user) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }
  if (user.role !== "admin") {
    sendFailure(res, 403, "FORBIDDEN", "Admin access is required.");
    return;
  }
  next();
};

chatRouter.get("/conversations", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const conversations = await Promise.all(
    (await postgresStore.listConversationsForUser(currentUserId)).map((conversation) =>
      toConversationResponse(conversation, currentUserId)
    )
  );
  sendSuccess(res, { conversations: conversations.filter((conversation) => !hasBlockedEither(conversation)) });
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
    const response = await toConversationResponse(existingConversation, currentUserId);
    if (hasBlockedEither(response)) {
      sendFailure(res, 403, "USER_BLOCKED", "\u4f60\u88ab\u5c4f\u853d/\u62c9\u9ed1\uff0c\u4e0d\u80fd\u53d1\u9001\u6d88\u606f");
      return;
    }
    sendSuccess(res, { conversation: response });
    return;
  }

  if (memberUserIds.length === 2) {
    const otherUserId = memberUserIds.find((userId) => userId !== currentUserId);
    if (otherUserId) {
      const [follow, block] = await Promise.all([
        postgresStore.getFollowSummary(currentUserId, otherUserId),
        postgresStore.getBlockSummary(currentUserId, otherUserId),
      ]);
      if (block.blockedEither) {
        sendFailure(res, 403, "USER_BLOCKED", "\u4f60\u88ab\u5c4f\u853d/\u62c9\u9ed1\uff0c\u4e0d\u80fd\u53d1\u9001\u6d88\u606f");
        return;
      }
      if (!follow.mutual) {
        sendFailure(res, 403, "DIRECT_MESSAGE_NOT_ALLOWED", "\u9700\u8981\u4e92\u76f8\u5173\u6ce8\u6216\u5df2\u6709\u804a\u5929\u8bb0\u5f55\u540e\u624d\u80fd\u53d1\u9001\u79c1\u4fe1\u3002");
        return;
      }
    }
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

chatRouter.post("/conversations/:conversationId/reply-suggestions", async (req, res) => {
  await handleAiSuggestionsRequest(req, res, "reply");
});

chatRouter.post("/conversations/:conversationId/ai-suggestions", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  await handleAiSuggestionsRequest(req, res, readAiSuggestionMode(body.mode));
});

chatRouter.get("/ai-suggestion-jobs/:jobId", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const result = await readAiSuggestionJob(req.params.jobId, currentUserId);
  if (!result) {
    sendFailure(res, 404, "AI_SUGGESTION_JOB_NOT_FOUND", "AI suggestion job not found.");
    return;
  }

  sendSuccess(res, result);
});

chatRouter.post("/ai-suggestion-feedback", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const body = req.body as Record<string, unknown>;
  const recommendationLogId = typeof body.recommendationLogId === "string" ? body.recommendationLogId.trim() : "";
  if (!recommendationLogId) {
    sendFailure(res, 400, "INVALID_AI_FEEDBACK", "recommendationLogId is required.");
    return;
  }

  const log = await updateAiSuggestionFeedback({
    recommendationLogId,
    requesterUserId: currentUserId,
    selectedIndex: typeof body.selectedIndex === "number" && Number.isInteger(body.selectedIndex) ? body.selectedIndex : undefined,
    selectedText: typeof body.selectedText === "string" && body.selectedText.trim() ? body.selectedText.trim().slice(0, 160) : undefined,
    sentMessageId: typeof body.sentMessageId === "string" && body.sentMessageId.trim() ? body.sentMessageId.trim() : undefined,
  });

  if (!log) {
    sendFailure(res, 404, "AI_RECOMMENDATION_LOG_NOT_FOUND", "AI recommendation log not found.");
    return;
  }

  sendSuccess(res, { log });
});

chatRouter.get("/admin/ai-suggestions/status", requireAdmin, async (_req, res) => {
  sendSuccess(res, await readAiSuggestionGovernanceStatus());
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
    body.type === "video" ||
    body.type === "audio"
      ? body.type
      : "text";
  const text = requiredString(body.text)
    ? body.text.trim()
    : type === "image"
      ? "[Image]"
      : type === "video"
        ? "[Video]"
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
    if (permission.code) {
      sendFailure(res, 403, permission.code, permission.message);
      return;
    }
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
  markAiSuggestionRecipientReply({
    conversationId: conversation.id,
    replierUserId: currentUserId,
    repliedAt: message.createdAt,
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
  if (await isDirectBlocked(conversation, currentUserId)) {
    sendFailure(res, 403, "USER_BLOCKED", "\u4f60\u88ab\u5c4f\u853d/\u62c9\u9ed1\uff0c\u4e0d\u80fd\u53d1\u9001\u6d88\u606f");
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
  if (await isDirectBlocked(conversation, currentUserId)) {
    sendFailure(res, 403, "USER_BLOCKED", "\u4f60\u88ab\u5c4f\u853d/\u62c9\u9ed1\uff0c\u4e0d\u80fd\u53d1\u9001\u6d88\u606f");
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
  const targetCard = await postgresStore.findMealCard(existing.targetCardId);
  if (request && conversation) {
    recordMealCardRecommendationEvent({
      userId: currentUserId,
      card: targetCard,
      cardId: existing.targetCardId,
      authorUserId: targetCard?.userId ?? existing.receiverUserId,
      eventType: body.status === "accepted" ? "accept" : "reject",
      matchScore: targetCard?.matchScore,
      reason: targetCard?.reason,
      context: { exchangeRequestId: existing.id, conversationId: conversation.id },
    });
    if (body.status === "accepted") {
      markAiSuggestionAdvancedToMeal({
        conversationId: conversation.id,
        requesterUserId: existing.senderUserId,
        advancedAt: request.updatedAt,
        outcome: { exchangeRequestId: existing.id, targetCardId: existing.targetCardId, eventType: "accept" },
      });
    }
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
        ...(await postgresStore.getBlockSummary(currentUserId, otherUserId)),
      }
    : { ...conversation, online: false };
}

function hasBlockedEither(conversation: Awaited<ReturnType<typeof toConversationResponse>>) {
  return Boolean(conversation && "blockedEither" in conversation && conversation.blockedEither);
}

async function checkDirectMessagePermission(
  conversation: NonNullable<Awaited<ReturnType<typeof postgresStore.findConversation>>>,
  currentUserId: string,
  type: "text" | "system" | "meal-card-exchange" | "image" | "video" | "audio",
  metadata: Record<string, unknown>
): Promise<{ allowed: true } | { allowed: false; code?: string; message: string; resetAt?: string }> {
  if (conversation.conversationType === "group" || conversation.memberUserIds.length !== 2) return { allowed: true };
  if (!countsTowardStrangerLimit(type, metadata)) return { allowed: true };

  const otherUserId = conversation.memberUserIds.find((userId) => userId !== currentUserId);
  if (!otherUserId) return { allowed: true };

  const block = await postgresStore.getBlockSummary(currentUserId, otherUserId);
  if (block.blockedEither) {
    return { allowed: false, code: "USER_BLOCKED", message: "\u4f60\u88ab\u5c4f\u853d/\u62c9\u9ed1\uff0c\u4e0d\u80fd\u53d1\u9001\u6d88\u606f" };
  }

  const follow = await postgresStore.getFollowSummary(currentUserId, otherUserId);
  if (follow.mutual) return { allowed: true };

  if (await postgresStore.hasDirectMessageBetween(currentUserId, otherUserId)) return { allowed: true };

  return { allowed: false, code: "DIRECT_MESSAGE_NOT_ALLOWED", message: "\u9700\u8981\u4e92\u76f8\u5173\u6ce8\u6216\u5df2\u6709\u804a\u5929\u8bb0\u5f55\u540e\u624d\u80fd\u53d1\u9001\u79c1\u4fe1\u3002" };

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

function countsTowardStrangerLimit(type: "text" | "system" | "meal-card-exchange" | "image" | "video" | "audio", metadata: Record<string, unknown>) {
  if (type === "system" || type === "meal-card-exchange") return false;
  if (metadata.postSnapshot || metadata.commentSnapshot) return false;
  return type === "text" || type === "image" || type === "video" || type === "audio";
}

async function isDirectBlocked(
  conversation: NonNullable<Awaited<ReturnType<typeof postgresStore.findConversation>>>,
  currentUserId: string
) {
  if (conversation.conversationType === "group" || conversation.memberUserIds.length !== 2) return false;
  const otherUserId = conversation.memberUserIds.find((userId) => userId !== currentUserId);
  if (!otherUserId) return false;
  return (await postgresStore.getBlockSummary(currentUserId, otherUserId)).blockedEither;
}

async function handleAiSuggestionsRequest(req: Request, res: Response, mode: AiSuggestionMode) {
  const currentUserId = getCurrentUserId(req);
  const conversation = await postgresStore.findConversation(req.params.conversationId);
  if (!conversation || !(await postgresStore.isConversationMember(conversation.id, currentUserId))) {
    sendFailure(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    return;
  }
  if (await isDirectBlocked(conversation, currentUserId)) {
    sendFailure(res, 403, "USER_BLOCKED", "\u4f60\u88ab\u5c4f\u853d/\u62c9\u9ed1\uff0c\u4e0d\u80fd\u53d1\u9001\u6d88\u606f");
    return;
  }

  const body = req.body as Record<string, unknown>;
  const draft = typeof body.draft === "string" ? body.draft.trim().slice(0, 160) : "";
  const messages = (await postgresStore.listMessages(conversation.id))
    .filter((message) => !message.revokedAt && message.type === "text" && message.text.trim())
    .slice(-12);
  const fallbackSuggestions = buildReplySuggestions(messages, currentUserId, conversation.conversationType === "group", draft);

  const result = await buildAiSuggestionResponse({
    conversation,
    currentUserId,
    messages,
    draft,
    mode,
    fallbackSuggestions,
  });
  sendSuccess(res, result);
}

function buildReplySuggestions(
  messages: Array<Pick<Message, "id" | "senderUserId" | "text">>,
  currentUserId: string,
  isGroup: boolean,
  draft: string
) {
  const lastMessage = messages[messages.length - 1];
  const lastText = normalizeMessageText(lastMessage?.text ?? "");
  const lastFromMe = lastMessage?.senderUserId === currentUserId;
  const currentTopic = draft || lastText;
  const suggestions = lastFromMe
    ? buildFollowUpSuggestions(currentTopic, isGroup)
    : buildResponsiveSuggestions(currentTopic, isGroup);

  return uniqueSuggestions(suggestions).slice(0, 4);
}

function buildResponsiveSuggestions(text: string, isGroup: boolean) {
  if (!text) {
    return [
      "嗨，我刚打开聊天。你今天想先聊吃的，还是聊校园里的新鲜事？",
      "我有点选择困难，要不要你先丢一个最近想吃的东西给我？",
      "先从一个轻松的问题开始：你最近发现过什么还不错的店吗？",
      "看到你啦。今天适合简单聊聊，还是直接约个饭搭子？",
    ];
  }

  if (/[?？吗嘛]|怎么|咋|有没有|要不要|想不想/.test(text)) {
    return [
      `我觉得可以呀。你刚说的「${clipTopic(text)}」，我也挺想听你多讲一点。`,
      "这个问题我认真想了一下：我更偏向愿意试试，但想先听听你的想法。",
      "可以，我不太想只给一个敷衍答案。你比较在意哪一点？",
      isGroup ? "这个话题可以展开，我先抛个想法，大家也可以接着补充。" : "你这么问还挺可爱的，我想认真回你。先说说你怎么想？",
    ];
  }

  if (/吃|饭|餐|奶茶|咖啡|火锅|食堂|店|约/.test(text)) {
    return [
      "听起来很适合边吃边聊。你更想轻松一点，还是找个安静点的地方？",
      "这个我有兴趣。要不我们先从时间和口味对一下？",
      `你说到「${clipTopic(text)}」我有点被种草了，方便多讲讲吗？`,
      "如果你不介意的话，我想知道你平时更喜欢热闹的饭局还是小范围聊天。",
    ];
  }

  if (/哈哈|笑|开心|有趣|好玩|绝了|太/.test(text)) {
    return [
      "哈哈这个画面感有了，你这样一说我也有点想知道后续。",
      "你这个描述很生动，我差点已经开始脑补现场了。",
      "这听起来挺开心的。你当时第一反应是什么？",
      "我喜欢这种轻松的话题，继续讲，我在认真听。",
    ];
  }

  if (/累|烦|难|emo|压力|焦虑|不想|崩/.test(text)) {
    return [
      "听起来你今天有点不容易。先不用急着解释，我在。",
      "如果你愿意讲，我可以听你慢慢说；如果不想讲，我们也可以换个轻松点的话题。",
      "这事确实会消耗人。你现在更想被安慰一下，还是一起想办法？",
      "抱抱你这个情绪。我们先把它拆小一点，哪一部分最让你难受？",
    ];
  }

  return [
    `你刚说的「${clipTopic(text)}」我接住了。这里面我最想追问的是：后来呢？`,
    "我有点好奇这个背后的细节，可以多说一点吗？",
    "这个话题挺适合继续聊。你是怎么想到它的？",
    isGroup ? "我先接一下这个话题：这个角度挺有意思，大家怎么看？" : "我喜欢你这样说话的节奏，感觉可以慢慢聊下去。",
  ];
}

function buildFollowUpSuggestions(text: string, isGroup: boolean) {
  const topic = clipTopic(text || "刚才那个话题");
  return [
    `补一句，我刚刚提到「${topic}」是因为真的有点好奇你的看法。`,
    "我是不是说得有点突然？你可以按你舒服的节奏回。",
    "换个轻松一点的问法：你最近有什么想尝试但还没去做的事吗？",
    isGroup ? "我先把话题放这儿，大家有想法都可以接。" : "当然，如果你现在不想聊这个，我们也可以从今天吃了什么开始。",
  ];
}

function normalizeMessageText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

function clipTopic(text: string) {
  const normalized = normalizeMessageText(text).replace(/[。！？!?]+$/g, "");
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized || "这件事";
}

function uniqueSuggestions(suggestions: string[]) {
  return Array.from(new Set(suggestions.map((suggestion) => suggestion.trim()).filter(Boolean)));
}
