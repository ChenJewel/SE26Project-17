import { describe, it, expect } from "vitest";
import type { Response } from "express";
import { sendSuccess, sendFailure, toPublicUser } from "../src/common/http.js";
import type { User } from "../src/types.js";

/** 构造一个 mock Express Response，记录最后设置的 status 与 body */
function mockRes() {
  const state: { status?: number; body?: unknown } = {};
  const res: Record<string, unknown> = {};
  res.status = (s: number) => {
    state.status = s;
    return res;
  };
  res.json = (b: unknown) => {
    state.body = b;
    return res;
  };
  return { res: res as unknown as Response, state };
}

describe("sendSuccess", () => {
  it("默认状态码 200 并包裹 { success, data }", () => {
    const { res, state } = mockRes();
    sendSuccess(res, { ok: true });
    expect(state.status).toBe(200);
    expect(state.body).toEqual({ success: true, data: { ok: true } });
  });

  it("自定义状态码", () => {
    const { res, state } = mockRes();
    sendSuccess(res, { id: 1 }, 201);
    expect(state.status).toBe(201);
    expect(state.body).toEqual({ success: true, data: { id: 1 } });
  });
});

describe("sendFailure", () => {
  it("无 details 时 error 不含 details 字段", () => {
    const { res, state } = mockRes();
    sendFailure(res, 400, "BAD_REQUEST", "参数错误");
    expect(state.status).toBe(400);
    expect(state.body).toEqual({
      success: false,
      error: { code: "BAD_REQUEST", message: "参数错误" },
    });
  });

  it("有 details 时 error 含 details", () => {
    const { res, state } = mockRes();
    sendFailure(res, 422, "INVALID", "校验失败", { field: "email" });
    expect(state.body).toEqual({
      success: false,
      error: { code: "INVALID", message: "校验失败", details: { field: "email" } },
    });
  });
});

describe("toPublicUser", () => {
  it("移除 passwordHash 保留其他字段", () => {
    const user = {
      id: "u1",
      email: "a@b.com",
      passwordHash: "secret-hash",
      nickname: "Alice",
      role: "user",
    } as User;
    const pub = toPublicUser(user);
    expect(pub).not.toHaveProperty("passwordHash");
    expect(pub.id).toBe("u1");
    expect(pub.email).toBe("a@b.com");
    expect((pub as Record<string, unknown>).nickname).toBe("Alice");
  });
});
