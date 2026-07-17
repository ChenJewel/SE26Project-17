import { useCallback, useEffect, useMemo, useState } from "react";
import { subscribePetActivity, type PetActivityKind } from "@/lib/petActivity";
import type { PetAnimationName } from "@/components/pet/vpetFrames";
import { fetchMyPetState, updateMyPetState } from "@/services/petApi";

export type PetPosition = {
  x: number;
  y: number;
};

export type PetContextPage = "home" | "community" | "create" | "chat" | "profile" | "settings";

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
  wallMode: "none" | "left" | "right";
  edgeHidden: "none" | "left" | "right";
  lastLine: string;
  lastSpokenAt: number;
  lastDecayedAt: number;
  lastContextPage: string;
  lastContextSpokenAt: number;
  daily: Record<string, Partial<Record<PetActivityKind, number>>>;
};

const storageKeyPrefix = "ueat-pet-companion-v2";

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
  wallMode: "none",
  edgeHidden: "none",
  lastLine: "今天也一起好好吃饭吧。",
  lastSpokenAt: 0,
  lastDecayedAt: 0,
  lastContextPage: "",
  lastContextSpokenAt: 0,
  daily: {},
};

const rewards: Record<PetActivityKind, { xp: number; hunger: number; mood: number; affinity: number; cap: number; line: string | string[]; action: PetAnimationName }> = {
  manual_feed: { xp: 6, hunger: 16, mood: 8, affinity: 4, cap: 12, line: ["投喂成功，元气补满一点点。", "饭饭收到！今天也要好好吃饭。", "小肚子亮灯，幸福到账。"], action: "eatHappy" },
  manual_drink: { xp: 4, hunger: 2, mood: 7, affinity: 3, cap: 12, line: ["咕嘟咕嘟，补水完成。", "喝水成功，精神值回升一点。", "杯子放好啦，我继续陪你。"], action: "drink" },
  meal_card: { xp: 18, hunger: 10, mood: 8, affinity: 4, cap: 4, line: ["新的约饭卡！它闻到饭香了。", "这张卡片写得不错，我帮你挥挥小旗。"], action: "saySelf" },
  exchange: { xp: 26, hunger: 12, mood: 12, affinity: 8, cap: 5, line: ["交换卡片成功，桌宠开心得转圈。", "约饭邀请飞出去啦，我在旁边小声加油。"], action: "levelUp" },
  post: { xp: 18, hunger: 8, mood: 10, affinity: 5, cap: 6, line: ["发帖被记录成今日小零食。", "社区又多了一点你的声音，我喜欢这个。"], action: "saySelf" },
  comment: { xp: 10, hunger: 5, mood: 7, affinity: 3, cap: 12, line: ["评论让它多认识了一点校园生活。", "你刚刚接住了别人的话题，我也记下了。"], action: "saySerious" },
  like: { xp: 3, hunger: 2, mood: 2, affinity: 1, cap: 20, line: ["轻轻一点赞，小点心到账。", "这个赞像一颗迷你糖。"], action: "touchHead" },
  favorite: { xp: 4, hunger: 2, mood: 3, affinity: 1, cap: 18, line: ["收藏也算给它存了一颗糖。", "我帮你把这个好东西夹进小本本。"], action: "touchHead" },
  share: { xp: 8, hunger: 4, mood: 5, affinity: 2, cap: 10, line: ["转发让它带着消息跑了一圈。", "消息出门旅行，我跟着蹦了一下。"], action: "walkRight" },
  message: { xp: 4, hunger: 2, mood: 3, affinity: 1, cap: 24, line: ["聊天声让它不孤单。", "你们聊着，我在旁边当小小气氛组。"], action: "sayShy" },
  group: { xp: 14, hunger: 6, mood: 8, affinity: 3, cap: 6, line: ["新的群聊广场，像进了热闹食堂。", "群聊广场好热闹，我探头看了一眼。"], action: "saySelf" },
};

const pageLines: Record<PetContextPage, string[]> = {
  home: ["首页有新的饭香雷达，我帮你盯着合适的约饭卡。", "看到心动饭友可以先打个招呼，我在旁边给你撑场子。"],
  community: ["社区好热闹，发点校园饭点见闻也会变成我的小零食。", "我刚刚路过评论区，那里像一张会说话的餐桌。"],
  create: ["写约饭卡的时候别紧张，真诚比华丽菜单更好吃。", "地点、时间、饭量写清楚，我就能帮你招来更合拍的人。"],
  chat: ["聊天窗口打开啦，我会安静一点，偶尔摇摇尾巴。", "聊久一点也没关系，我在旁边当小小气氛组。"],
  profile: ["这是你的桌宠管家角落，我的数据小肚皮都在这里。", "换标签会影响我记住你的口味，像给我贴便利贴。"],
  settings: ["设置页我会小声一点，不挡你整理开关。", "如果要清理数据，记得先摸摸我，我有点仪式感。"],
};

const pageActions: Record<PetContextPage, PetAnimationName> = {
  home: "saySelf",
  community: "saySerious",
  create: "think",
  chat: "sayShy",
  profile: "saySelf",
  settings: "saySerious",
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getDefaultPosition() {
  if (typeof window === "undefined") return defaultState.position;
  return {
    x: 16,
    y: Math.max(96, window.innerHeight - 278),
  };
}

function getStorageKey(userId?: string) {
  return userId ? `${storageKeyPrefix}:${userId}` : `${storageKeyPrefix}:guest`;
}

function pickLine(line: string | string[]) {
  if (!Array.isArray(line)) return line;
  return line[Math.floor(Math.random() * line.length)] ?? line[0] ?? "";
}

function normalizeState(input: Partial<PetCompanionState> | null | undefined, defaultPosition = getDefaultPosition()): PetCompanionState {
  return {
    ...defaultState,
    ...input,
    level: Math.max(1, Math.round(input?.level ?? defaultState.level)),
    xp: Math.max(0, Math.round(input?.xp ?? defaultState.xp)),
    hunger: clamp(Math.round(input?.hunger ?? defaultState.hunger)),
    mood: clamp(Math.round(input?.mood ?? defaultState.mood)),
    affinity: clamp(Math.round(input?.affinity ?? defaultState.affinity)),
    position: { ...defaultPosition, ...input?.position },
    size: input?.size === "sm" || input?.size === "lg" ? input.size : "md",
    currentAction: input?.currentAction ?? "idle",
    wallMode: input?.wallMode === "left" || input?.wallMode === "right" ? input.wallMode : "none",
    edgeHidden: input?.edgeHidden === "left" || input?.edgeHidden === "right" ? input.edgeHidden : "none",
    lastSpokenAt: input?.lastSpokenAt ?? 0,
    lastDecayedAt: input?.lastDecayedAt ?? Date.now(),
    lastContextPage: input?.lastContextPage ?? "",
    lastContextSpokenAt: input?.lastContextSpokenAt ?? 0,
    daily: input?.daily ?? {},
  };
}

function applyPassiveDecay(state: PetCompanionState, now = Date.now()) {
  const lastDecayedAt = state.lastDecayedAt || now;
  const elapsed = now - lastDecayedAt;
  const decaySteps = Math.floor(elapsed / (15 * 60 * 1000));
  if (decaySteps <= 0) return state;

  const hunger = clamp(state.hunger - decaySteps);
  const moodDrop = Math.floor(decaySteps * (hunger < 25 ? 1.5 : hunger < 50 ? 0.75 : 0.35));
  const affinityDrop = hunger < 20 ? Math.floor(elapsed / (6 * 60 * 60 * 1000)) : 0;
  const mood = clamp(state.mood - moodDrop);
  const affinity = clamp(state.affinity - affinityDrop);
  const shouldRest = hunger <= 12;

  return {
    ...state,
    hunger,
    mood,
    affinity,
    lastDecayedAt: lastDecayedAt + decaySteps * 15 * 60 * 1000,
    currentAction: shouldRest ? "sleep" : state.currentAction,
    wallMode: shouldRest ? "none" : state.wallMode,
    edgeHidden: shouldRest ? "none" : state.edgeHidden,
    lastLine: shouldRest && state.currentAction !== "sleep" ? "肚子空空，我先趴着睡会儿。投喂一下就能醒。" : state.lastLine,
    lastSpokenAt: shouldRest && state.currentAction !== "sleep" ? now : state.lastSpokenAt,
  };
}

function pickPageLine(page: PetContextPage, level: number) {
  const lines = pageLines[page];
  return lines[level % lines.length] ?? lines[0];
}

function readInitialState(userId?: string): PetCompanionState {
  if (typeof window === "undefined") return defaultState;
  const defaultPosition = getDefaultPosition();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getStorageKey(userId)) || "null") as Partial<PetCompanionState> | null;
    return applyPassiveDecay(normalizeState({ ...parsed, currentAction: "idle", wallMode: parsed?.wallMode ?? "none", edgeHidden: parsed?.edgeHidden ?? "none" }, defaultPosition));
  } catch {
    return normalizeState(null, defaultPosition);
  }
}

function xpToNext(level: number) {
  return 90 + level * 35;
}

export function usePetCompanion(isAuthenticated: boolean, preferenceTags: string[], userId?: string, currentPage: PetContextPage = "home") {
  const storageKey = useMemo(() => getStorageKey(userId), [userId]);
  const [loadedStorageKey, setLoadedStorageKey] = useState(storageKey);
  const [cloudLoadedStorageKey, setCloudLoadedStorageKey] = useState("");
  const [pet, setPet] = useState<PetCompanionState>(() => readInitialState(userId));

  const tagLine = useMemo(() => {
    const tags = preferenceTags.slice(0, 3).join("、");
    return tags ? `我记住了你的偏好：${tags}。` : "先告诉我你喜欢吃什么吧。";
  }, [preferenceTags]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setPet((current) => current.lastLine ? current : { ...current, lastLine: tagLine });
  }, [isAuthenticated, tagLine]);

  useEffect(() => {
    setPet(readInitialState(userId));
    setLoadedStorageKey(storageKey);
    setCloudLoadedStorageKey("");
  }, [storageKey, userId]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    let cancelled = false;
    fetchMyPetState()
      .then((remote) => {
        if (cancelled) return;
        const hasRemoteState = Object.keys(remote.state ?? {}).length > 0;
        setPet((current) => applyPassiveDecay(hasRemoteState ? normalizeState(remote.state) : current));
      })
      .catch((error) => {
        console.warn("Failed to load cloud pet state, keeping local state.", error);
      })
      .finally(() => {
        if (!cancelled) setCloudLoadedStorageKey(storageKey);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, storageKey, userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loadedStorageKey !== storageKey) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ ...pet, currentAction: "idle", wallMode: pet.wallMode, edgeHidden: pet.edgeHidden }));
  }, [loadedStorageKey, pet, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated || !userId) return;
    if (loadedStorageKey !== storageKey || cloudLoadedStorageKey !== storageKey) return;

    const timer = window.setTimeout(() => {
      updateMyPetState({ ...pet, currentAction: "idle" }).catch((error) => {
        console.warn("Failed to sync cloud pet state.", error);
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [cloudLoadedStorageKey, isAuthenticated, loadedStorageKey, pet, storageKey, userId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = window.setInterval(() => {
      setPet((current) => applyPassiveDecay(current));
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated]);

  const grant = useCallback((kind: PetActivityKind, label?: string) => {
    if (!isAuthenticated || !userId) return;
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
          lastSpokenAt: Date.now(),
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
        wallMode: "none",
        edgeHidden: "none",
        currentAction: kind === "manual_feed" && current.hunger > 72 ? "eatNormal" : leveled ? "levelUp" : reward.action,
        lastLine: label ?? (leveled ? `升级到 Lv.${nextLevel} 啦。` : pickLine(reward.line)),
        lastSpokenAt: Date.now(),
        lastDecayedAt: Date.now(),
        daily: {
          ...current.daily,
          [day]: {
            ...dailyForDay,
            [kind]: used + 1,
          },
        },
      };
    });
  }, [isAuthenticated, userId]);

  useEffect(() => subscribePetActivity((event) => grant(event.kind, event.label)), [grant]);

  useEffect(() => {
    if (!isAuthenticated || pet.collapsed || !pet.visible) return;
    const now = Date.now();
    const changedPage = pet.lastContextPage !== currentPage;
    const quietEnough = now - pet.lastContextSpokenAt > 8 * 60 * 1000;
    if (!changedPage && !quietEnough) return;

    const timer = window.setTimeout(() => {
      setPet((current) => {
        const latestNow = Date.now();
        if (current.collapsed || !current.visible || current.currentAction === "sleep") return current;
        if (current.lastContextPage === currentPage && latestNow - current.lastContextSpokenAt <= 8 * 60 * 1000) return current;
        return {
          ...current,
          currentAction: current.wallMode === "none" && current.edgeHidden === "none" ? pageActions[currentPage] : current.currentAction,
          lastLine: pickPageLine(currentPage, current.level),
          lastSpokenAt: latestNow,
          lastContextPage: currentPage,
          lastContextSpokenAt: latestNow,
        };
      });
    }, changedPage ? 700 : 0);

    return () => window.clearTimeout(timer);
  }, [currentPage, isAuthenticated, pet.collapsed, pet.lastContextPage, pet.lastContextSpokenAt, pet.visible]);

  useEffect(() => {
    if (!isAuthenticated || currentPage !== "chat") return;
    const timer = window.setInterval(() => {
      setPet((current) => {
        const now = Date.now();
        if (current.collapsed || !current.visible || current.currentAction === "sleep") return current;
        if (now - current.lastSpokenAt < 110 * 1000) return current;
        return {
          ...current,
          currentAction: current.wallMode === "none" && current.edgeHidden === "none" ? "sayShy" : current.currentAction,
          lastLine: "聊了这么久，我给你们端来一杯虚拟温水。",
          lastSpokenAt: now,
        };
      });
    }, 120 * 1000);
    return () => window.clearInterval(timer);
  }, [currentPage, isAuthenticated]);

  const patchPet = useCallback((patch: Partial<PetCompanionState>) => {
    setPet((current) => ({ ...current, ...patch, ...(patch.lastLine !== undefined ? { lastSpokenAt: Date.now() } : {}) }));
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
