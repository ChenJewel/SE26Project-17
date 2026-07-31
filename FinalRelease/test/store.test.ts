import { describe, it, expect } from "vitest";
import { makeId, hashPassword, timestamp, getDatabaseFilePath } from "../src/data/store.js";

describe("makeId", () => {
  it("带前缀生成唯一 ID", () => {
    const id1 = makeId("card");
    const id2 = makeId("card");
    expect(id1).not.toBe(id2);
    expect(id1.startsWith("card-")).toBe(true);
  });

  it("不同前缀", () => {
    expect(makeId("user").startsWith("user-")).toBe(true);
    expect(makeId("conv").startsWith("conv-")).toBe(true);
  });
});

describe("hashPassword", () => {
  it("相同密码 → 相同哈希（确定性）", () => {
    expect(hashPassword("mypass")).toBe(hashPassword("mypass"));
  });

  it("不同密码 → 不同哈希", () => {
    expect(hashPassword("pass1")).not.toBe(hashPassword("pass2"));
  });

  it("返回 SHA-256 hex（64 字符）", () => {
    expect(hashPassword("test")).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hashPassword("test"))).toBe(true);
  });
});

describe("timestamp", () => {
  it("返回 ISO 格式字符串", () => {
    const ts = timestamp();
    expect(typeof ts).toBe("string");
    expect(Number.isFinite(Date.parse(ts))).toBe(true);
  });
});

describe("getDatabaseFilePath", () => {
  it("返回以 dev-db.json 结尾的路径", () => {
    const path = getDatabaseFilePath();
    expect(path).toContain("dev-db.json");
  });
});
