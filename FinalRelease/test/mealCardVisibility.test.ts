import { describe, it, expect } from "vitest";
import {
  getMealCardScheduleDate,
  isMealCardVisibleOnHome,
  filterHomeVisibleMealCards,
  getMealCardScheduleScore,
} from "../src/common/mealCardVisibility.js";

// 固定基准时间：2024-01-15 12:00:00（本地时间）
const NOW = new Date(2024, 0, 15, 12, 0, 0);

/** 构造一张餐卡（time + 可选 createdAt） */
function card(time: string, createdAt?: string) {
  return { time, createdAt } as { time: string; createdAt?: string };
}

/** 构造距 now 指定小时数的卡片时间字符串（explicitDate + clock） */
function cardHoursFromNow(hours: number) {
  const target = new Date(NOW.getTime() + hours * 36e5);
  const time = `${target.getFullYear()}-${target.getMonth() + 1}-${target.getDate()} ${target.getHours()}:${String(target.getMinutes()).padStart(2, "0")}`;
  return card(time);
}

describe("getMealCardScheduleDate - explicitDate 格式", () => {
  it("YYYY-MM-DD", () => {
    const d = getMealCardScheduleDate(card("2024-06-15"), NOW);
    expect(d).toBeTruthy();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(5); // 6 月 → index 5
    expect(d!.getDate()).toBe(15);
  });

  it("YYYY年M月D日", () => {
    const d = getMealCardScheduleDate(card("2024年6月15日 18:30"), NOW);
    expect(d).toBeTruthy();
    expect(d!.getHours()).toBe(18);
    expect(d!.getMinutes()).toBe(30);
  });

  it("YYYY.M.D", () => {
    const d = getMealCardScheduleDate(card("2024.6.15"), NOW);
    expect(d).toBeTruthy();
    expect(d!.getDate()).toBe(15);
  });

  it("带时分（YYYY-MM-DD HH:MM）", () => {
    const d = getMealCardScheduleDate(card("2024-06-15 14:30"), NOW);
    expect(d!.getHours()).toBe(14);
    expect(d!.getMinutes()).toBe(30);
  });
});

describe("getMealCardScheduleDate - 月日格式", () => {
  it("M月D日", () => {
    const d = getMealCardScheduleDate(card("6月15日"), NOW);
    expect(d).toBeTruthy();
    expect(d!.getMonth()).toBe(5);
    expect(d!.getDate()).toBe(15);
  });

  it("M月D号", () => {
    const d = getMealCardScheduleDate(card("6月15号"), NOW);
    expect(d).toBeTruthy();
    expect(d!.getDate()).toBe(15);
  });

  it("月份靠近年底时推断为上一年（inferClosestYear）", () => {
    // now = 1月15日，12月15日 去年更近
    const d = getMealCardScheduleDate(card("12月15日"), NOW);
    expect(d).toBeTruthy();
    expect(d!.getFullYear()).toBe(2023);
  });

  it("月份靠近年中时推断为当年", () => {
    const d = getMealCardScheduleDate(card("3月15日"), NOW);
    expect(d).toBeTruthy();
    expect(d!.getFullYear()).toBe(2024);
  });
});

describe("getMealCardScheduleDate - 斜杠日期格式", () => {
  it("M/D", () => {
    const d = getMealCardScheduleDate(card("6/15"), NOW);
    expect(d).toBeTruthy();
    expect(d!.getMonth()).toBe(5);
    expect(d!.getDate()).toBe(15);
  });

  it("M-D", () => {
    const d = getMealCardScheduleDate(card("6-15"), NOW);
    expect(d).toBeTruthy();
    expect(d!.getDate()).toBe(15);
  });
});

describe("getMealCardScheduleDate - 相对日期", () => {
  it("后天", () => {
    const d = getMealCardScheduleDate(card("后天 12:00"), NOW);
    expect(d).toBeTruthy();
    expect(d!.getDate()).toBe(17); // 15 + 2
    expect(d!.getHours()).toBe(12);
  });

  it("明天", () => {
    const d = getMealCardScheduleDate(card("明天 18:30"), NOW);
    expect(d!.getDate()).toBe(16);
    expect(d!.getHours()).toBe(18);
  });

  it("明晚（偏移 1，normalizeClock 不识别'明晚'为晚上标记 → 7 点）", () => {
    const d = getMealCardScheduleDate(card("明晚 7点"), NOW);
    expect(d!.getDate()).toBe(16);
    expect(d!.getHours()).toBe(7); // "明晚" 不含"晚上"/"今晚"等关键词，不触发 +12
  });

  it("明天晚上7点（含'晚上'关键词 → +12）", () => {
    const d = getMealCardScheduleDate(card("明天晚上7点"), NOW);
    expect(d!.getDate()).toBe(16);
    expect(d!.getHours()).toBe(19);
  });

  it("昨天（偏移 -1）", () => {
    const d = getMealCardScheduleDate(card("昨天 12:00"), NOW);
    expect(d!.getDate()).toBe(14);
  });

  it("今天", () => {
    const d = getMealCardScheduleDate(card("今天 14:00"), NOW);
    expect(d!.getDate()).toBe(15);
    expect(d!.getHours()).toBe(14);
  });

  it("今晚（偏移 0，时间 18:30）", () => {
    const d = getMealCardScheduleDate(card("今晚 7点"), NOW);
    expect(d!.getDate()).toBe(15);
    expect(d!.getHours()).toBe(19);
  });

  it("中午（偏移 0，时间 12:00）", () => {
    const d = getMealCardScheduleDate(card("中午"), NOW);
    expect(d!.getDate()).toBe(15);
    expect(d!.getHours()).toBe(12);
  });

  it("午饭（偏移 0，时间 12:00）", () => {
    const d = getMealCardScheduleDate(card("午饭"), NOW);
    expect(d!.getHours()).toBe(12);
  });

  it("晚饭（偏移 0，时间 18:30）", () => {
    const d = getMealCardScheduleDate(card("晚饭"), NOW);
    expect(d!.getHours()).toBe(18);
    expect(d!.getMinutes()).toBe(30);
  });
});

describe("getMealCardScheduleDate - 仅时钟", () => {
  it("HH:MM（冒号时钟）", () => {
    const d = getMealCardScheduleDate(card("14:30"), NOW);
    expect(d).toBeTruthy();
    expect(d!.getHours()).toBe(14);
    expect(d!.getMinutes()).toBe(30);
  });

  it("HH：MM（中文冒号）", () => {
    const d = getMealCardScheduleDate(card("14：30"), NOW);
    expect(d!.getHours()).toBe(14);
    expect(d!.getMinutes()).toBe(30);
  });

  it("下午3点（CN 时钟 + 下午偏移）", () => {
    const d = getMealCardScheduleDate(card("下午3点"), NOW);
    expect(d!.getHours()).toBe(15);
  });

  it("晚上8点", () => {
    const d = getMealCardScheduleDate(card("晚上8点"), NOW);
    expect(d!.getHours()).toBe(20);
  });

  it("3点半（CN 时钟 + 半）", () => {
    const d = getMealCardScheduleDate(card("3点半"), NOW);
    expect(d!.getMinutes()).toBe(30);
  });

  it("3点30分（CN 时钟 + 分）", () => {
    const d = getMealCardScheduleDate(card("3点30分"), NOW);
    expect(d!.getHours()).toBe(3);
    expect(d!.getMinutes()).toBe(30);
  });

  it("中午12点（中午 + hour>=11 不加 12）", () => {
    const d = getMealCardScheduleDate(card("中午12点"), NOW);
    expect(d!.getHours()).toBe(12);
  });

  it("午饭11点（午饭 + hour<11 加 12）", () => {
    const d = getMealCardScheduleDate(card("午饭11点"), NOW);
    // "午饭" 偏移 0，11点。normalizeClock: 中午/午饭 + hour<11 → +12。但 11 不 < 11，所以不加。
    expect(d!.getHours()).toBe(11);
  });
});

describe("getMealCardScheduleDate - 无法解析", () => {
  it("空字符串 → null（回退 createdAt）", () => {
    const d = getMealCardScheduleDate(card("", "2024-01-10T00:00:00Z"), NOW);
    // createdAt 有效，parseMealTime 返回 null → scheduleDate = createdAt
    expect(d).toBeTruthy();
  });

  it("无意义文本且无 createdAt → null", () => {
    const d = getMealCardScheduleDate(card("abc"), NOW);
    expect(d).toBeNull();
  });

  it("空白时间且无 createdAt → null", () => {
    const d = getMealCardScheduleDate(card("   "), NOW);
    expect(d).toBeNull();
  });
});

describe("getMealCardScheduleDate - createdAt 作为 anchor", () => {
  it("createdAt 有效时作为 anchor", () => {
    // createdAt 在 2024-06-01，time = "明天" → 6月2日
    const d = getMealCardScheduleDate(card("明天 12:00", "2024-06-01T10:00:00Z"), NOW);
    expect(d).toBeTruthy();
    // 6月1日 + 1 天 = 6月2日（注意时区，UTC 10:00 在本地可能不同日期）
    expect(d!.getMonth()).toBe(5); // 6月
  });
});

describe("isMealCardVisibleOnHome", () => {
  it("无法解析时间且无 createdAt → true", () => {
    expect(isMealCardVisibleOnHome(card("abc"), NOW)).toBe(true);
  });

  it("未来时间 → true", () => {
    expect(isMealCardVisibleOnHome(cardHoursFromNow(2), NOW)).toBe(true);
  });

  it("今天（当天开始）→ true", () => {
    expect(isMealCardVisibleOnHome(card("2024-1-15 8:00"), NOW)).toBe(true);
  });

  it("过去时间 → false", () => {
    expect(isMealCardVisibleOnHome(card("2024-1-10 8:00"), NOW)).toBe(false);
  });

  it("昨天 → false", () => {
    expect(isMealCardVisibleOnHome(card("昨天 12:00"), NOW)).toBe(false);
  });
});

describe("filterHomeVisibleMealCards", () => {
  it("过滤掉不可见的卡片", () => {
    const cards = [
      card("2024-1-15 14:00"), // 今天未来 → 可见
      card("2024-1-10 8:00"), // 过去 → 不可见
      card("2024-1-16 12:00"), // 明天 → 可见
      card("abc"), // 无法解析 → 可见
    ];
    const visible = filterHomeVisibleMealCards(cards, NOW);
    expect(visible).toHaveLength(3);
  });

  it("空数组 → 空数组", () => {
    expect(filterHomeVisibleMealCards([], NOW)).toEqual([]);
  });
});

describe("getMealCardScheduleScore", () => {
  it("无法解析 → 0.5", () => {
    expect(getMealCardScheduleScore(card("abc"), NOW)).toBe(0.5);
  });

  it("已过去（hoursUntilMeal < 0）→ 0.58", () => {
    expect(getMealCardScheduleScore(cardHoursFromNow(-5), NOW)).toBe(0.58);
  });

  it("2 小时内（<= 4）→ 1", () => {
    expect(getMealCardScheduleScore(cardHoursFromNow(2), NOW)).toBe(1);
  });

  it("12 小时后（<= 24）→ 0.92", () => {
    expect(getMealCardScheduleScore(cardHoursFromNow(12), NOW)).toBe(0.92);
  });

  it("48 小时后（<= 72）→ 0.78", () => {
    expect(getMealCardScheduleScore(cardHoursFromNow(48), NOW)).toBe(0.78);
  });

  it("100 小时后（<= 168）→ 0.64", () => {
    expect(getMealCardScheduleScore(cardHoursFromNow(100), NOW)).toBe(0.64);
  });

  it("200 小时后（<= 336）→ 0.5", () => {
    expect(getMealCardScheduleScore(cardHoursFromNow(200), NOW)).toBe(0.5);
  });

  it("400 小时后（> 336）→ 0.42", () => {
    expect(getMealCardScheduleScore(cardHoursFromNow(400), NOW)).toBe(0.42);
  });

  it("4 小时整（边界）→ 1", () => {
    expect(getMealCardScheduleScore(cardHoursFromNow(4), NOW)).toBe(1);
  });

  it("24 小时整（边界）→ 0.92", () => {
    expect(getMealCardScheduleScore(cardHoursFromNow(24), NOW)).toBe(0.92);
  });
});
