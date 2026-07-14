import { Router } from "express";
import type { RequestHandler } from "express";
import { sendFailure, sendSuccess } from "../common/http.js";
import { getCurrentUserId, requiredString } from "../common/request.js";
import { postgresStore } from "../data/postgres.js";
import { makeId, timestamp } from "../data/store.js";
import type { Report } from "../types.js";

export const reportsRouter = Router();

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

reportsRouter.post("/reports", async (req, res) => {
  const body = req.body as Record<string, unknown>;

  if (
    !(body.targetType === "post" || body.targetType === "comment" || body.targetType === "meal-card" || body.targetType === "user") ||
    !requiredString(body.targetId) ||
    !requiredString(body.reason)
  ) {
    sendFailure(res, 400, "INVALID_REPORT", "targetType, targetId, and reason are required.");
    return;
  }

  const createdAt = timestamp();
  const reporterUserId = getCurrentUserId(req);
  const reporter = await postgresStore.findUserById(reporterUserId);
  if (!reporter) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  const report: Report = {
    id: makeId("report"),
    reporterUserId,
    targetType: body.targetType,
    targetId: body.targetId.trim(),
    reason: body.reason.trim(),
    status: "pending",
    createdAt,
    updatedAt: createdAt,
  };

  await postgresStore.createReport(report);
  sendSuccess(res, { report }, 201);
});

reportsRouter.get("/admin/reports", requireAdmin, async (_req, res) => {
  sendSuccess(res, { reports: await postgresStore.listReports() });
});

reportsRouter.patch("/admin/reports/:reportId", requireAdmin, async (req, res) => {
  const report = await postgresStore.findReport(req.params.reportId);
  const body = req.body as Record<string, unknown>;

  if (!report) {
    sendFailure(res, 404, "REPORT_NOT_FOUND", "Report not found.");
    return;
  }

  if (body.status !== "pending" && body.status !== "approved" && body.status !== "rejected") {
    sendFailure(res, 400, "INVALID_REPORT_STATUS", "status must be pending, approved, or rejected.");
    return;
  }

  const updatedReport = await postgresStore.updateReport(report.id, { status: body.status });
  sendSuccess(res, { report: updatedReport });
});
