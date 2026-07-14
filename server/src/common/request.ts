import type { Request } from "express";

export function getCurrentUserId(req: Request) {
  const headerUserId = req.header("x-user-id");
  if (headerUserId?.trim()) return headerUserId.trim();

  const authorization = req.header("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (token) return token;
  }

  return "user-demo";
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
