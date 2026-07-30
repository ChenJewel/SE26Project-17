import { Router } from "express";
import type { RequestHandler } from "express";
import { sendFailure, sendSuccess } from "../common/http.js";
import { getCurrentUserId, requiredString } from "../common/request.js";
import { postgresStore } from "../data/postgres.js";
import { makeId, timestamp } from "../data/store.js";
import type { UserFeedback } from "../types.js";

export const feedbackRouter = Router();

const feedbackCategories = new Set<UserFeedback["category"]>(["bug", "experience", "feature", "other"]);
const feedbackStatuses = new Set<UserFeedback["status"]>(["open", "reviewed", "closed"]);

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

feedbackRouter.post("/feedback", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const currentUserId = getCurrentUserId(req);
  const user = await postgresStore.findUserById(currentUserId);

  if (!user) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  if (!feedbackCategories.has(body.category as UserFeedback["category"]) || !requiredString(body.text)) {
    sendFailure(res, 400, "INVALID_FEEDBACK", "category and text are required.");
    return;
  }

  const text = body.text.trim();
  if (text.length < 6 || text.length > 1000) {
    sendFailure(res, 400, "INVALID_FEEDBACK_TEXT", "Feedback text must be between 6 and 1000 characters.");
    return;
  }

  const contact = typeof body.contact === "string" ? body.contact.trim().slice(0, 120) : "";
  const appVersion = typeof body.appVersion === "string" ? body.appVersion.trim().slice(0, 80) : "";
  const userAgent = req.header("user-agent")?.trim().slice(0, 300) || "";
  const createdAt = timestamp();
  const feedback: UserFeedback = {
    id: makeId("feedback"),
    userId: currentUserId,
    category: body.category as UserFeedback["category"],
    text,
    contact: contact || undefined,
    status: "open",
    appVersion: appVersion || undefined,
    userAgent: userAgent || undefined,
    createdAt,
    updatedAt: createdAt,
  };

  sendSuccess(res, { feedback: await postgresStore.createUserFeedback(feedback) }, 201);
});

feedbackRouter.get("/admin/feedback", requireAdmin, async (_req, res) => {
  sendSuccess(res, { feedback: await postgresStore.listUserFeedback() });
});

feedbackRouter.patch("/admin/feedback/:feedbackId", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const status = body.status as UserFeedback["status"];

  if (!feedbackStatuses.has(status)) {
    sendFailure(res, 400, "INVALID_FEEDBACK_STATUS", "status must be open, reviewed, or closed.");
    return;
  }

  const feedback = await postgresStore.updateUserFeedbackStatus(req.params.feedbackId, status);
  if (!feedback) {
    sendFailure(res, 404, "FEEDBACK_NOT_FOUND", "Feedback not found.");
    return;
  }

  sendSuccess(res, { feedback });
});
