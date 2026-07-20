import type { MealCard } from "@/types/meal";

type MealCardTimeFields = Pick<MealCard, "time" | "createdAt">;

export function getMealCardScheduleDate(card: MealCardTimeFields, now = new Date()) {
  const createdAt = parseIsoDate(card.createdAt);
  const anchor = createdAt ?? now;
  return parseMealTime(card.time, anchor) ?? createdAt;
}

export function isMealCardVisibleOnHome(card: MealCardTimeFields, now = new Date()) {
  const scheduleDate = getMealCardScheduleDate(card, now);
  if (!scheduleDate) return true;
  return scheduleDate.getTime() >= startOfLocalDay(now).getTime();
}

function parseMealTime(value: string, anchor: Date) {
  const normalized = value.trim();
  if (!normalized) return null;

  const explicitDate = normalized.match(/(\d{4})[-/.年]\s*(\d{1,2})[-/.月]\s*(\d{1,2})/);
  if (explicitDate) {
    return buildDate(Number(explicitDate[1]), Number(explicitDate[2]), Number(explicitDate[3]), normalized);
  }

  const monthDay = normalized.match(/(?:^|[^\d])(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)?/);
  if (monthDay) {
    const month = Number(monthDay[1]);
    const day = Number(monthDay[2]);
    return buildDate(inferClosestYear(month, day, anchor), month, day, normalized);
  }

  const slashDate = normalized.match(/(?:^|[^\d])(\d{1,2})\s*[/-]\s*(\d{1,2})(?:[^\d]|$)/);
  if (slashDate) {
    const month = Number(slashDate[1]);
    const day = Number(slashDate[2]);
    return buildDate(inferClosestYear(month, day, anchor), month, day, normalized);
  }

  const relativeOffset = getRelativeDayOffset(normalized);
  if (relativeOffset !== null) {
    const target = addDays(startOfLocalDay(anchor), relativeOffset);
    const clock = parseClock(normalized);
    target.setHours(clock.hour, clock.minute, 0, 0);
    return target;
  }

  const clock = parseClock(normalized);
  if (clock.explicit) {
    const target = startOfLocalDay(anchor);
    target.setHours(clock.hour, clock.minute, 0, 0);
    return target;
  }

  return null;
}

function buildDate(year: number, month: number, day: number, value: string) {
  const clock = parseClock(value);
  const date = new Date(year, month - 1, day, clock.hour, clock.minute, 0, 0);
  return Number.isFinite(date.getTime()) ? date : null;
}

function inferClosestYear(month: number, day: number, anchor: Date) {
  const baseYear = anchor.getFullYear();
  const candidates = [baseYear - 1, baseYear, baseYear + 1];
  return candidates.reduce((bestYear, year) => {
    const bestDistance = Math.abs(new Date(bestYear, month - 1, day).getTime() - anchor.getTime());
    const distance = Math.abs(new Date(year, month - 1, day).getTime() - anchor.getTime());
    return distance < bestDistance ? year : bestYear;
  }, baseYear);
}

function getRelativeDayOffset(value: string) {
  if (value.includes("后天")) return 2;
  if (value.includes("明天") || value.includes("明晚")) return 1;
  if (value.includes("昨天")) return -1;
  if (value.includes("今天") || value.includes("今晚") || value.includes("中午") || value.includes("午饭") || value.includes("晚饭")) return 0;
  return null;
}

function parseClock(value: string) {
  const colonClock = value.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
  if (colonClock) return normalizeClock(Number(colonClock[1]), Number(colonClock[2]), value, true);

  const cnClock = value.match(/(\d{1,2})\s*点\s*(半|(\d{1,2})\s*分?)?/);
  if (cnClock) return normalizeClock(Number(cnClock[1]), cnClock[2] === "半" ? 30 : Number(cnClock[3] ?? 0), value, true);

  if (value.includes("中午") || value.includes("午饭")) return { hour: 12, minute: 0, explicit: false };
  if (value.includes("今晚") || value.includes("晚饭")) return { hour: 18, minute: 30, explicit: false };
  return { hour: 12, minute: 0, explicit: false };
}

function normalizeClock(hourInput: number, minuteInput: number, value: string, explicit: boolean) {
  let hour = Number.isFinite(hourInput) ? hourInput : 12;
  const minute = Number.isFinite(minuteInput) ? Math.max(0, Math.min(59, minuteInput)) : 0;
  if ((value.includes("下午") || value.includes("晚上") || value.includes("晚饭") || value.includes("今晚")) && hour < 12) hour += 12;
  if ((value.includes("中午") || value.includes("午饭")) && hour < 11) hour += 12;
  return { hour: Math.max(0, Math.min(23, hour)), minute, explicit };
}

function parseIsoDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}
