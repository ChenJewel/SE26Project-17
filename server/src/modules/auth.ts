import { Router } from "express";
import { getCurrentUserId, requiredString } from "../common/request.js";
import { sendFailure, sendSuccess, toPublicUser } from "../common/http.js";
import { postgresStore } from "../data/postgres.js";
import { hashPassword, makeId } from "../data/store.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const body = req.body as Record<string, unknown>;

  if (!requiredString(body.email) || !requiredString(body.password) || !requiredString(body.nickname)) {
    sendFailure(res, 400, "INVALID_REGISTER_PAYLOAD", "email, password, and nickname are required.");
    return;
  }

  const email = body.email.trim().toLowerCase();
  const mbti = typeof body.mbti === "string" ? body.mbti.trim().toUpperCase() : "";
  const preferenceTags = /^[EI][NS][FT][JP]$/.test(mbti) ? [mbti] : [];
  const existingUser = await postgresStore.findUserByEmail(email);
  if (existingUser) {
    sendFailure(res, 409, "EMAIL_EXISTS", "This email is already registered.");
    return;
  }

  const user = await postgresStore.createUser({
    id: makeId("user"),
    email,
    passwordHash: hashPassword(body.password),
    nickname: body.nickname.trim(),
    avatarText: body.nickname.trim().slice(0, 1).toUpperCase(),
    verified: false,
    preferenceTags,
    profileCompleted: false,
  });

  sendSuccess(res, { user: toPublicUser(user), token: user.id }, 201);
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

  sendSuccess(res, { user: toPublicUser(user), token: user.id });
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

authRouter.post("/send-email-code", (req, res) => {
  const body = req.body as Record<string, unknown>;

  if (!requiredString(body.email)) {
    sendFailure(res, 400, "INVALID_EMAIL", "email is required.");
    return;
  }

  sendSuccess(res, {
    email: body.email.trim().toLowerCase(),
    sent: true,
    devCode: "000000",
  });
});

authRouter.post("/verify-email", async (req, res) => {
  const userId = getCurrentUserId(req);
  const existingUser = await postgresStore.findUserById(userId);

  if (!existingUser) {
    sendFailure(res, 401, "UNAUTHENTICATED", "Current user was not found.");
    return;
  }

  const user = await postgresStore.verifyUser(userId);
  sendSuccess(res, { user: toPublicUser(user) });
});
