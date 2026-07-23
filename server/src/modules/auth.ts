import { Router } from "express";
import type { RequestHandler } from "express";
import { getCurrentUserId, requiredString } from "../common/request.js";
import { createAuthToken } from "../common/authToken.js";
import { sendFailure, sendSuccess, toPublicUser } from "../common/http.js";
import { postgresStore } from "../data/postgres.js";
import { hashPassword, makeId } from "../data/store.js";
import { resolveCampusEmail } from "./campusEmail.js";
import { getEmailCodeDailyStats, sendPasswordResetEmailCode, sendRegisterEmailCode, verifyPasswordResetEmailCode, verifyRegisterEmailCode } from "./emailVerification.js";
import { createInvitationCode, listInvitationCodes, redeemInvitationCode, releaseInvitationRedemption, updateInvitationCode } from "./invitationCodes.js";

export const authRouter = Router();

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

authRouter.post("/register", async (req, res) => {
  const body = req.body as Record<string, unknown>;

  if (!requiredString(body.email) || !requiredString(body.password) || !requiredString(body.nickname) || (!requiredString(body.emailCode) && !requiredString(body.inviteCode))) {
    sendFailure(res, 400, "INVALID_REGISTER_PAYLOAD", "email, password, nickname, and either emailCode or inviteCode are required.");
    return;
  }

  const campus = resolveCampusEmail(body.email);
  if (!campus.valid) {
    sendFailure(res, 400, "NOT_CAMPUS_EMAIL", "Only campus email addresses can register.");
    return;
  }

  const email = campus.email;
  const mbti = typeof body.mbti === "string" ? body.mbti.trim().toUpperCase() : "";
  const preferenceTags = /^[EI][NS][FT][JP]$/.test(mbti) ? [mbti] : [];
  const existingUser = await postgresStore.findUserByEmail(email);
  if (existingUser) {
    sendFailure(res, 409, "EMAIL_EXISTS", "This email is already registered.");
    return;
  }

  let verifiedBy = "email-code";
  if (requiredString(body.emailCode)) {
    const verification = await verifyRegisterEmailCode(email, body.emailCode);
    if (!verification.ok) {
      sendFailure(res, 400, verification.code, verification.message);
      return;
    }
  } else {
    verifiedBy = "invitation-code";
  }

  const userId = makeId("user");
  if (requiredString(body.inviteCode) && verifiedBy === "invitation-code") {
    const invitation = await redeemInvitationCode(body.inviteCode, { email, userId });
    if (!invitation.ok) {
      sendFailure(res, 400, invitation.code, invitation.message);
      return;
    }
  }

  let user;
  try {
    user = await postgresStore.createUser({
      id: userId,
      email,
      passwordHash: hashPassword(body.password),
      nickname: body.nickname.trim(),
      avatarText: body.nickname.trim().slice(0, 1).toUpperCase(),
      verified: true,
      school: campus.school,
      preferenceTags,
      profileCompleted: false,
    });
  } catch (error) {
    if (verifiedBy === "invitation-code") {
      await releaseInvitationRedemption({ email, userId }).catch((releaseError) => {
        console.error("[ueat] Failed to release invitation redemption after registration error.", releaseError);
      });
    }
    throw error;
  }

  sendSuccess(res, { user: toPublicUser(user), token: createAuthToken(user.id) }, 201);
});

authRouter.post("/login", async (req, res) => {
  const body = req.body as Record<string, unknown>;

  if (!requiredString(body.email) || !requiredString(body.password)) {
    sendFailure(res, 400, "INVALID_LOGIN_PAYLOAD", "email and password are required.");
    return;
  }

  const email = body.email.trim().toLowerCase();
  const user = await postgresStore.findUserByEmail(email);

  if (!user || user.passwordHash !== hashPassword(body.password)) {
    sendFailure(res, 401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    return;
  }

  sendSuccess(res, { user: toPublicUser(user), token: createAuthToken(user.id) });
});

authRouter.post("/logout", (_req, res) => {
  sendSuccess(res, { loggedOut: true });
});

authRouter.get("/me", async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await postgresStore.findUserById(userId);

  if (!user) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  sendSuccess(res, { user: toPublicUser(user) });
});

authRouter.post("/send-email-code", async (req, res) => {
  const body = req.body as Record<string, unknown>;

  if (!requiredString(body.email)) {
    sendFailure(res, 400, "INVALID_EMAIL", "email is required.");
    return;
  }

  const existingUser = await postgresStore.findUserByEmail(body.email.trim().toLowerCase());
  if (existingUser) {
    sendFailure(res, 409, "EMAIL_EXISTS", "This email is already registered.");
    return;
  }

  const result = await sendRegisterEmailCode(body.email);
  if (!result.ok) {
    const status = result.code === "EMAIL_CODE_TOO_FREQUENT" || result.code === "EMAIL_CODE_DAILY_LIMIT_REACHED" ? 429 : result.code === "EMAIL_CODE_DELIVERY_FAILED" ? 502 : 400;
    sendFailure(res, status, result.code, result.message);
    return;
  }

  sendSuccess(res, { sent: true, ...result });
});

authRouter.post("/send-password-reset-code", async (req, res) => {
  const body = req.body as Record<string, unknown>;

  if (!requiredString(body.email)) {
    sendFailure(res, 400, "INVALID_EMAIL", "email is required.");
    return;
  }

  const campus = resolveCampusEmail(body.email);
  if (!campus.valid) {
    sendFailure(res, 400, "NOT_CAMPUS_EMAIL", "Only whitelisted campus email addresses can reset password.");
    return;
  }

  const existingUser = await postgresStore.findUserByEmail(campus.email);
  if (existingUser) {
    const result = await sendPasswordResetEmailCode(campus.email);
    if (!result.ok) {
      const status = result.code === "EMAIL_CODE_TOO_FREQUENT" || result.code === "EMAIL_CODE_DAILY_LIMIT_REACHED" ? 429 : result.code === "EMAIL_CODE_DELIVERY_FAILED" ? 502 : 400;
      sendFailure(res, status, result.code, result.message);
      return;
    }
    sendSuccess(res, { sent: true, email: result.email, school: result.school, expiresInSeconds: result.expiresInSeconds, dailyRemaining: result.dailyRemaining, devCode: result.devCode });
    return;
  }

  sendSuccess(res, {
    sent: true,
    email: campus.email,
    school: campus.school,
    expiresInSeconds: 600,
  });
});

authRouter.post("/reset-password", async (req, res) => {
  const body = req.body as Record<string, unknown>;

  if (!requiredString(body.email) || !requiredString(body.emailCode) || !requiredString(body.password)) {
    sendFailure(res, 400, "INVALID_RESET_PASSWORD_PAYLOAD", "email, emailCode, and password are required.");
    return;
  }

  if (body.password.trim().length < 6) {
    sendFailure(res, 400, "WEAK_PASSWORD", "Password must be at least 6 characters.");
    return;
  }

  const campus = resolveCampusEmail(body.email);
  if (!campus.valid) {
    sendFailure(res, 400, "NOT_CAMPUS_EMAIL", "Only whitelisted campus email addresses can reset password.");
    return;
  }

  const existingUser = await postgresStore.findUserByEmail(campus.email);
  if (!existingUser) {
    sendFailure(res, 404, "USER_NOT_FOUND", "No account exists for this email.");
    return;
  }

  const verification = await verifyPasswordResetEmailCode(campus.email, body.emailCode);
  if (!verification.ok) {
    sendFailure(res, 400, verification.code, verification.message);
    return;
  }

  await postgresStore.updateUserPassword(existingUser.id, hashPassword(body.password));
  sendSuccess(res, { reset: true });
});

authRouter.get("/admin/email-code-stats", requireAdmin, async (req, res) => {
  const day = typeof req.query.day === "string" ? req.query.day.trim() : undefined;
  sendSuccess(res, await getEmailCodeDailyStats(day || undefined));
});

authRouter.get("/admin/invitation-codes", requireAdmin, async (_req, res) => {
  sendSuccess(res, { invitations: await listInvitationCodes() });
});

authRouter.post("/admin/invitation-codes", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const result = await createInvitationCode({
    createdByUserId: getCurrentUserId(req),
    label: typeof body.label === "string" ? body.label : undefined,
    maxUses: typeof body.maxUses === "number" ? body.maxUses : undefined,
    expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
    expiresInDays: typeof body.expiresInDays === "number" ? body.expiresInDays : undefined,
  });
  sendSuccess(res, result, 201);
});

authRouter.patch("/admin/invitation-codes/:invitationId", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const invitation = await updateInvitationCode(req.params.invitationId, {
    label: typeof body.label === "string" ? body.label : undefined,
    active: typeof body.active === "boolean" ? body.active : undefined,
    maxUses: typeof body.maxUses === "number" ? body.maxUses : undefined,
    expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
  });
  if (!invitation) {
    sendFailure(res, 404, "INVITATION_CODE_NOT_FOUND", "Invitation code was not found.");
    return;
  }
  sendSuccess(res, { invitation });
});

authRouter.post("/verify-email", async (req, res) => {
  const userId = getCurrentUserId(req);
  const existingUser = await postgresStore.findUserById(userId);

  if (!existingUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  const body = req.body as Record<string, unknown>;
  const verification = await verifyRegisterEmailCode(existingUser.email, body.emailCode);
  if (!verification.ok) {
    sendFailure(res, 400, verification.code, verification.message);
    return;
  }

  const user = await postgresStore.updateUser(userId, { school: verification.school });
  await postgresStore.verifyUser(userId);
  sendSuccess(res, { user: toPublicUser((await postgresStore.findUserById(userId)) ?? user!) });
});
