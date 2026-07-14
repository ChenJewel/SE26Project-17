import type { Response } from "express";
import type { ApiFailure, ApiSuccess, PublicUser, User } from "../types.js";

export function sendSuccess<T>(res: Response, data: T, status = 200) {
  const payload: ApiSuccess<T> = {
    success: true,
    data,
  };

  return res.status(status).json(payload);
}

export function sendFailure(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown
) {
  const payload: ApiFailure = {
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };

  return res.status(status).json(payload);
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
