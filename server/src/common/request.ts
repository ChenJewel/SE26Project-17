import type { Request } from "express";
import { verifyAuthToken } from "./authToken.js";

export const anonymousUserId = "__anonymous__";

export function getCurrentUserId(req: Request) {
  const allowInsecureUserIdAuth = process.env.ALLOW_INSECURE_USER_ID_AUTH === "true";
  const headerUserId = req.header("x-user-id");
  if (allowInsecureUserIdAuth && headerUserId?.trim()) return headerUserId.trim();

  const authorization = req.header("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    const userId = verifyAuthToken(token);
    if (userId) return userId;
  }

  return process.env.ALLOW_DEMO_AUTH_FALLBACK === "true" ? "user-demo" : anonymousUserId;
}

export function requiredString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function numberValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
