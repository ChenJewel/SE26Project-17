import { useCallback, useEffect, useMemo, useState } from "react";
import { subscribePetActivity, type PetActivityKind } from "@/lib/petActivity";
import type { PetAnimationName } from "@/components/pet/vpetFrames";

export type PetPosition = {
  x: number;
  y: number;
};

export type PetCompanionState = {
  visible: boolean;
  collapsed: boolean;
  level: number;
  xp: number;
  hunger: number;
  mood: number;
  affinity: number;
  size: "sm" | "md" | "lg";
  position: PetPosition;
  currentAction: PetAnimationName;
  lastLine: string;
  daily: Record<string, Partial<Record<PetActivityKind, number>>>;
};

const storageKey = "ueat-pet-companion-v2";

const defaultState: PetCompanionState = {
  visible: true,
  collapsed: false,
  level: 1,
  xp: 0,
  hunger: 72,
  mood: 76,
  affinity: 12,
  size: "md",
  position: { x: 16, y: 420 },
  currentAction: "idle",
  lastLine: "今天也一起好好吃饭吧。",
  daily: {},
};

const rewards: Record<PetActivityKind, { xp: number; hunger: number; mood: number; affinity: number; cap: number; line: string; action: PetAnimationName }> = {
  manual_feed: { xp: 6, hunger: 16, mood: 8, affinity: 4, cap: 12, line: "投喂成功，元气补满一点点。", action: "eat" },
  meal_card: { xp: 18, hunger: 10, mood: 8, affinity: 4, cap: 4, line: "新的约饭卡！它闻到饭香了。", action: "happy" },
  exchange: { xp: 26, hunger: 12, mood: 12, affinity: 8, cap: 5, line: "交换卡片成功，桌宠开心得转圈。", action: "levelUp" },
  post: { xp: 18, hunger: 8, mood: 10, affinity: 5, cap: 6, line: "发帖被记录成今日小零食。", action: "happy" },
  comment: { xp: 10, hunger: 5, mood: 7, affinity: 3, cap: 12, line: "评论让它多认识了一点校园生活。", action: "happy" },
  like: { xp: 3, hunger: 2, mood: 2, affinity: 1, cap: 20, line: "轻轻一点赞，小点心到账。", action: "touch" },
  favorite: { xp: 4, hunger: 2, mood: 3, affinity: 1, cap: 18, line: "收藏也算给它存了一颗糖。", action: "touch" },
  share: { xp: 8, hunger: 4, mood: 5, affinity: 2, cap: 10, line: "转发让它带着消息跑了一圈。", action: "happy" },
  message: { xp: 4, hunger: 2, mood: 3, affinity: 1, cap: 24, line: "聊天声让它不孤单。", action: "touch" },
  group: { xp: 14, hunger: 6, mood: 8, affinity: 3, cap: 6, line: "新的群聊广场，像进了热闹食堂。", action: "happy" },
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function readInitialState(): PetCompanionState {
  if (typeof window === "undefined") return defaultState;
  const defaultPosition = {
    x: 16,
    y: Math.max(96, window.innerHeight - 278),
  };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "null") as Partial<PetCompanionState> | null;
    return {
      ...defaultState,
      ...parsed,
      position: { ...defaultPosition, ...parsed?.position },
      daily: parsed?.daily ?? {},
      currentAction: "idle",
    };
  } catch {
    return { ...defaultState, position: defaultPosition };
  }
}

function xpToNext(level: number) {
  return 90 + level * 35;
}

export function usePetCompanion(isAuthenticated: boolean, preferenceTags: string[]) {
  const [pet, setPet] = useState<PetCompanionState>(() => readInitialState());

  const tagLine = useMemo(() => {
    const tags = preferenceTags.slice(0, 3).join("、");
    return tags ? `我记住了你的偏好：${tags}。` : "先告诉我你喜欢吃什么吧。";
  }, [preferenceTags]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setPet((current) => current.lastLine ? current : { ...current, lastLine: tagLine });
  }, [isAuthenticated, tagLine]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify({ ...pet, currentAction: "idle" }));
  }, [pet]);

  const grant = useCallback((kind: PetActivityKind, label?: string) => {
    if (!isAuthenticated) return;
    const reward = rewards[kind];
    setPet((current) => {
      const day = todayKey();
      const dailyForDay = current.daily[day] ?? {};
      const used = dailyForDay[kind] ?? 0;
      if (used >= reward.cap) {
        return {
          ...current,
          currentAction: "touch",
          lastLine: "今天这种小零食吃够啦，换点别的互动吧。",
        };
      }

      let nextLevel = current.level;
      let nextXp = current.xp + reward.xp;
      const needed = xpToNext(nextLevel);
      const leveled = nextXp >= needed;
      if (leveled) {
        nextLevel += 1;
        nextXp -= needed;
      }

      return {
        ...current,
        level: nextLevel,
        xp: nextXp,
        hunger: clamp(current.hunger + reward.hunger),
        mood: clamp(current.mood + reward.mood),
        affinity: clamp(current.affinity + reward.affinity),
        currentAction: leveled ? "levelUp" : reward.action,
        lastLine: label ?? (leveled ? `升级到 Lv.${nextLevel} 啦。` : reward.line),
        daily: {
          ...current.daily,
          [day]: {
            ...dailyForDay,
            [kind]: used + 1,
          },
        },
      };
    });
  }, [isAuthenticated]);

  useEffect(() => subscribePetActivity((event) => grant(event.kind, event.label)), [grant]);

  const patchPet = useCallback((patch: Partial<PetCompanionState>) => {
    setPet((current) => ({ ...current, ...patch }));
  }, []);

  const movePet = useCallback((position: PetPosition) => {
    setPet((current) => ({ ...current, position }));
  }, []);

  const finishAction = useCallback(() => {
    setPet((current) => ({ ...current, currentAction: current.currentAction === "sleep" ? "sleep" : "idle" }));
  }, []);

  return {
    pet,
    xpToNext: xpToNext(pet.level),
    grant,
    patchPet,
    movePet,
    finishAction,
  };
}
