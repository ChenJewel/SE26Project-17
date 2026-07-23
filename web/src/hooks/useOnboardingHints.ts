import { useCallback, useEffect, useMemo, useState } from "react";

export type OnboardingHintId =
  | "home-swipe"
  | "home-background"
  | "chat-background"
  | "pet-enable"
  | "pet-feed-water"
  | "pet-low-hunger"
  | "pet-low-mood"
  | "pet-level-up"
  | "pet-edge"
  | "wardrobe-intro";

const STORAGE_PREFIX = "ueat-onboarding-hints-v1";

function getStorageKey(userId?: string) {
  return `${STORAGE_PREFIX}:${userId || "guest"}`;
}

function readSeenHints(storageKey: string): OnboardingHintId[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is OnboardingHintId => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeSeenHints(storageKey: string, hints: OnboardingHintId[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(hints));
  } catch {
    // localStorage can be unavailable in private or restricted webviews.
  }
}

export function useOnboardingHints(userId?: string) {
  const storageKey = useMemo(() => getStorageKey(userId), [userId]);
  const [seenHints, setSeenHints] = useState<OnboardingHintId[]>(() => readSeenHints(storageKey));

  useEffect(() => {
    setSeenHints(readSeenHints(storageKey));
  }, [storageKey]);

  const markHintSeen = useCallback((id: OnboardingHintId) => {
    setSeenHints((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      writeSeenHints(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const dismissHint = useCallback((id: OnboardingHintId) => {
    markHintSeen(id);
  }, [markHintSeen]);

  const isHintSeen = useCallback((id: OnboardingHintId) => seenHints.includes(id), [seenHints]);

  return {
    dismissHint,
    isHintSeen,
    markHintSeen,
    seenHints,
  };
}
