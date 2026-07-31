import { describe, it, expect, vi } from "vitest";
import { normalizeEmail, resolveCampusEmail } from "../src/modules/campusEmail.js";

describe("normalizeEmail", () => {
  it("小写化并 trim", () => {
    expect(normalizeEmail("  Test@FUDAN.EDU.CN  ")).toBe("test@fudan.edu.cn");
  });
  it("非字符串返回空串", () => {
    expect(normalizeEmail(123)).toBe("");
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail({})).toBe("");
  });
});

describe("resolveCampusEmail", () => {
  it("配置的域名直接匹配", () => {
    const r = resolveCampusEmail("test@fudan.edu.cn");
    expect(r.valid).toBe(true);
    expect(r.email).toBe("test@fudan.edu.cn");
    expect(r.domain).toBe("fudan.edu.cn");
    expect(r.school).toBe("复旦大学");
  });

  it("配置域名的子域名匹配（endsWith）", () => {
    const r = resolveCampusEmail("a@mail.fudan.edu.cn");
    expect(r.valid).toBe(true);
    expect(r.school).toBe("复旦大学");
  });

  it("已知域名（非配置）直接匹配", () => {
    // pku.edu.cn 不在 CAMPUS_EMAIL_DOMAINS 中，但在 knownCampusDomains 中
    const r = resolveCampusEmail("a@pku.edu.cn");
    expect(r.valid).toBe(true);
    expect(r.school).toBe("北京大学");
  });

  it("已知域名的子域名匹配（endsWith）", () => {
    // cs.pku.edu.cn 不在 knownCampusDomains 直接 key 中，但 endsWith .pku.edu.cn
    const r = resolveCampusEmail("a@cs.pku.edu.cn");
    expect(r.valid).toBe(true);
    expect(r.school).toBe("北京大学");
  });

  it("已知域名直接 key 匹配（m.fudan.edu.cn 走 known 因配置也是 fudan）", () => {
    // m.fudan.edu.cn 在 knownCampusDomains 中；配置 fudan.edu.cn 也会 endsWith 匹配
    // 先走 configured，应返回复旦大学
    const r = resolveCampusEmail("a@m.fudan.edu.cn");
    expect(r.valid).toBe(true);
    expect(r.school).toBe("复旦大学");
  });

  it("无效邮箱 - 空字符串", () => {
    const r = resolveCampusEmail("");
    expect(r.valid).toBe(false);
    expect(r.email).toBe("");
  });

  it("无效邮箱 - 无 @", () => {
    expect(resolveCampusEmail("testfudan.edu.cn").valid).toBe(false);
  });

  it("无效邮箱 - 格式错误", () => {
    expect(resolveCampusEmail("a@b").valid).toBe(false);
    expect(resolveCampusEmail("@b.com").valid).toBe(false);
    expect(resolveCampusEmail("a@.com").valid).toBe(false);
    expect(resolveCampusEmail("a b@c.com").valid).toBe(false);
  });

  it("未知域名", () => {
    const r = resolveCampusEmail("test@gmail.com");
    expect(r.valid).toBe(false);
    expect(r.domain).toBe("gmail.com");
    expect(r.school).toBe("");
  });

  it("非字符串输入", () => {
    const r = resolveCampusEmail(null);
    expect(r.valid).toBe(false);
    expect(r.email).toBe("");
  });

  it("配置中无学校名时返回默认校园邮箱", () => {
    vi.stubEnv("CAMPUS_EMAIL_DOMAINS", "custom.edu.cn");
    const r = resolveCampusEmail("a@custom.edu.cn");
    expect(r.valid).toBe(true);
    expect(r.school).toBe("校园邮箱");
    vi.unstubAllEnvs();
  });

  it("配置项域名为空时跳过", () => {
    vi.stubEnv("CAMPUS_EMAIL_DOMAINS", "  ,fudan.edu.cn:复旦大学");
    const r = resolveCampusEmail("a@fudan.edu.cn");
    expect(r.valid).toBe(true);
    expect(r.school).toBe("复旦大学");
    vi.unstubAllEnvs();
  });
});
