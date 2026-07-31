import { describe, it, expect, vi, afterEach } from "vitest";
import { createAuthToken, verifyAuthToken } from "../src/common/authToken.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createAuthToken", () => {
  it("生成带 ueat.v1 前缀的 4 段 token", () => {
    const token = createAuthToken("user-1");
    expect(token.startsWith("ueat.v1.")).toBe(true);
    expect(token.split(".")).toHaveLength(4);
  });

  it("创建的 token 能被 verifyAuthToken 验证", () => {
    const token = createAuthToken("user-abc");
    expect(verifyAuthToken(token)).toBe("user-abc");
  });
});

describe("verifyAuthToken", () => {
  it("undefined → undefined", () => {
    expect(verifyAuthToken(undefined)).toBeUndefined();
  });

  it("空字符串 → undefined", () => {
    expect(verifyAuthToken("")).toBeUndefined();
  });

  it("段数不足 → undefined", () => {
    expect(verifyAuthToken("ueat.v1.payload")).toBeUndefined();
  });

  it("前缀不匹配 → undefined", () => {
    expect(verifyAuthToken("other.v1.x.y")).toBeUndefined();
  });

  it("签名篡改 → undefined", () => {
    const token = createAuthToken("user-1");
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${"A".repeat(parts[3].length)}`;
    expect(verifyAuthToken(tampered)).toBeUndefined();
  });

  it("过期 token → undefined", () => {
    // AUTH_TOKEN_TTL_DAYS=30，构造 31 天前的 token
    const expired = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const token = createAuthToken("user-exp", expired);
    expect(verifyAuthToken(token)).toBeUndefined();
  });

  it("sub 为空白 → undefined", () => {
    const token = createAuthToken("   ");
    expect(verifyAuthToken(token)).toBeUndefined();
  });

  it("有效 token 返回 sub", () => {
    const token = createAuthToken("valid-user");
    expect(verifyAuthToken(token)).toBe("valid-user");
  });
});

describe("readTokenTtlMs（通过 createAuthToken 间接验证）", () => {
  it("AUTH_TOKEN_TTL_DAYS 为正数时使用配置值", () => {
    vi.stubEnv("AUTH_TOKEN_TTL_DAYS", "1");
    // 1 天前的 token 在 TTL=1 天时刚好过期边界，用 0.5 天前验证有效
    const recent = Date.now() - 6 * 60 * 60 * 1000; // 6 小时前
    const token = createAuthToken("user-recent", recent);
    expect(verifyAuthToken(token)).toBe("user-recent");
  });

  it("AUTH_TOKEN_TTL_DAYS 无效时回退默认 30 天", () => {
    vi.stubEnv("AUTH_TOKEN_TTL_DAYS", "not-a-number");
    const token = createAuthToken("user-default-ttl");
    expect(verifyAuthToken(token)).toBe("user-default-ttl");
  });

  it("AUTH_TOKEN_TTL_DAYS 为 0 或负数时回退默认", () => {
    vi.stubEnv("AUTH_TOKEN_TTL_DAYS", "0");
    const token = createAuthToken("user-neg-ttl");
    expect(verifyAuthToken(token)).toBe("user-neg-ttl");
  });
});
