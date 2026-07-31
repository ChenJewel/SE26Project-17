import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMySettings, updateMySettings } from "@/services/settingsApi";
import type { BackgroundPreferences, AppBackground } from "@/types/background";
import type { AppSettings } from "@/types/settings";

type SettingsWithBackgrounds = Partial<AppSettings> & {
  backgroundPreferences?: BackgroundPreferences;
};

const storageKey = "ueat-background-preferences-v1";

const emptyPreferences: BackgroundPreferences = {
  chats: {},
};

function normalizePreferences(value: unknown): BackgroundPreferences {
  if (!value || typeof value !== "object") return emptyPreferences;
  const raw = value as BackgroundPreferences;
  return {
    home: raw.home ?? null,
    chats: raw.chats && typeof raw.chats === "object" ? raw.chats : {},
  };
}

function readLocalPreferences(): BackgroundPreferences {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return normalizePreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return emptyPreferences;
  }
}

function writeLocalPreferences(preferences: BackgroundPreferences) {
  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
}

export function useBackgroundPreferences(currentUserId?: string) {
  const [preferences, setPreferences] = useState<BackgroundPreferences>(() => readLocalPreferences());
  const latestSettingsRef = useRef<SettingsWithBackgrounds>({});

  useEffect(() => {
    let cancelled = false;
    fetchMySettings()
      .then((result) => {
        if (cancelled) return;
        const settings = result.settings as SettingsWithBackgrounds;
        latestSettingsRef.current = settings;
        const nextPreferences = normalizePreferences(settings.backgroundPreferences);
        setPreferences(nextPreferences);
        writeLocalPreferences(nextPreferences);
      })
      .catch((error) => {
        if (!cancelled) console.warn("Failed to load background preferences.", error);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const persistPreferences = useCallback(async (nextPreferences: BackgroundPreferences) => {
    setPreferences(nextPreferences);
    writeLocalPreferences(nextPreferences);

    try {
      const latest = await fetchMySettings();
      latestSettingsRef.current = latest.settings as SettingsWithBackgrounds;
    } catch {
      // Keep local changes even if the cloud read fails.
    }

    const nextSettings: SettingsWithBackgrounds = {
      ...latestSettingsRef.current,
      backgroundPreferences: nextPreferences,
    };
    latestSettingsRef.current = nextSettings;
    await updateMySettings(nextSettings);
  }, []);

  const setHomeBackground = useCallback((background: AppBackground | null) => {
    const nextPreferences = { ...preferences, home: background };
    return persistPreferences(nextPreferences);
  }, [persistPreferences, preferences]);

  const setChatBackground = useCallback((conversationId: string, background: AppBackground | null) => {
    const nextPreferences = {
      ...preferences,
      chats: {
        ...(preferences.chats ?? {}),
        [conversationId]: background,
      },
    };
    return persistPreferences(nextPreferences);
  }, [persistPreferences, preferences]);

  return {
    preferences,
    homeBackground: preferences.home ?? null,
    getChatBackground: (conversationId: string) => preferences.chats?.[conversationId] ?? null,
    setHomeBackground,
    setChatBackground,
  };
}
