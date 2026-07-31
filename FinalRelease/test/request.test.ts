import { describe, it, expect, vi, afterEach } from "vitest";
import type { Request } from "express";
import {
  getCurrentUserId,
  requiredString,
  optionalString,
  stringArray,
  numberValue,
  anonymousUserId,
} from "../src/common/request.js";
import { createAuthToken } from "../src/common/authToken.js";

function mockReq(headers: Record<string, string> = {}): Request {
  return { header: (name: string) => headers[name] } as unknown as Request;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getCurrentUserId", () => {
  it("允许 insecure 且有 x-user-id header → 返回 header 值", () => {
    vi.stubEnv("ALLOW_INSECURE_USER_ID_AUTH", "true");
    expect(getCurrentUserId(mockReq({ "x-user-id": "user-abc" }))).toBe("user-abc");
  });

  it("x-user-id 为空白时不使用，走 fallback", () => {
    vi.stubEnv("ALLOW_INSECURE_USER_ID_AUTH", "true");
    vi.stubEnv("ALLOW_DEMO_AUTH_FALLBACK", "true");
    expect(getCurrentUserId(mockReq({ "x-user-id": "   " }))).toBe("user-demo");
  });

  it("有效 Bearer token → 返回 token 中的 userId", () => {
    vi.stubEnv("ALLOW_INSECURE_USER_ID_AUTH", "false");
    const token = createAuthToken("user-from-token");
    expect(getCurrentUserId(mockReq({ authorization: `Bearer ${token}` }))).toBe("user-from-token");
  });

  it("无效 Bearer token → demo fallback", () => {
    vi.stubEnv("ALLOW_INSECURE_USER_ID_AUTH", "false");
    vi.stubEnv("ALLOW_DEMO_AUTH_FALLBACK", "true");
    expect(getCurrentUserId(mockReq({ authorization: "Bearer bad.token.here" }))).toBe("user-demo");
  });

  it("authorization 非 Bearer 前缀 → fallback", () => {
    vi.stubEnv("ALLOW_INSECURE_USER_ID_AUTH", "false");
    vi.stubEnv("ALLOW_DEMO_AUTH_FALLBACK", "true");
    expect(getCurrentUserId(mockReq({ authorization: "Basic abc" }))).toBe("user-demo");
  });

  it("无任何认证头 + demo fallback → user-demo", () => {
    vi.stubEnv("ALLOW_INSECURE_USER_ID_AUTH", "true");
    vi.stubEnv("ALLOW_DEMO_AUTH_FALLBACK", "true");
    expect(getCurrentUserId(mockReq({}))).toBe("user-demo");
  });

  it("无 demo fallback → anonymousUserId", () => {
    vi.stubEnv("ALLOW_INSECURE_USER_ID_AUTH", "false");
    vi.stubEnv("ALLOW_DEMO_AUTH_FALLBACK", "false");
    expect(getCurrentUserId(mockReq({}))).toBe(anonymousUserId);
    expect(anonymousUserId).toBe("__anonymous__");
  });

  it("insecure 关闭时忽略 x-user-id", () => {
    vi.stubEnv("ALLOW_INSECURE_USER_ID_AUTH", "false");
    vi.stubEnv("ALLOW_DEMO_AUTH_FALLBACK", "true");
    expect(getCurrentUserId(mockReq({ "x-user-id": "ignored" }))).toBe("user-demo");
  });
});

describe("requiredString", () => {
  it("非空字符串 → true", () => expect(requiredString("hello")).toBe(true));
  it("空白字符串 → false", () => expect(requiredString("  ")).toBe(false));
  it("空字符串 → false", () => expect(requiredString("")).toBe(false));
  it("非字符串 → false", () => {
    expect(requiredString(123)).toBe(false);
    expect(requiredString(null)).toBe(false);
    expect(requiredString(undefined)).toBe(false);
    expect(requiredString(true)).toBe(false);
  });
});

describe("optionalString", () => {
  it("undefined → true", () => expect(optionalString(undefined)).toBe(true));
  it("字符串 → true", () => expect(optionalString("x")).toBe(true));
  it("空字符串 → true", () => expect(optionalString("")).toBe(true));
  it("非字符串 → false", () => {
    expect(optionalString(123)).toBe(false);
    expect(optionalString(null)).toBe(false);
  });
});

describe("stringArray", () => {
  it("字符串数组 → true", () => expect(stringArray(["a", "b"])).toBe(true));
  it("空数组 → true", () => expect(stringArray([])).toBe(true));
  it("含非字符串 → false", () => expect(stringArray(["a", 1])).toBe(false));
  it("非数组 → false", () => {
    expect(stringArray("abc")).toBe(false);
    expect(stringArray(null)).toBe(false);
  });
});

describe("numberValue", () => {
  it("有限数 → true", () => {
    expect(numberValue(42)).toBe(true);
    expect(numberValue(0)).toBe(true);
    expect(numberValue(-1.5)).toBe(true);
  });
  it("NaN → false", () => expect(numberValue(NaN)).toBe(false));
  it("Infinity → false", () => {
    expect(numberValue(Infinity)).toBe(false);
    expect(numberValue(-Infinity)).toBe(false);
  });
  it("非数字 → false", () => {
    expect(numberValue("42")).toBe(false);
    expect(numberValue(null)).toBe(false);
  });
});
