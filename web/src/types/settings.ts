import type { BackgroundPreferences } from "@/types/background";

export type ToggleKey =
  | "mealInvites"
  | "chatMessages"
  | "communityReplies"
  | "quietHours"
  | "profileVisible"
  | "searchable"
  | "followOnlyDm"
  | "blurSensitive"
  | "haptics"
  | "compactCards"
  | "reduceMotion"
  | "darkMode";

export type AppSettings = Record<ToggleKey, boolean> & {
  reminderMinutes: number;
  locationPrecision: "campus" | "restaurant" | "off";
  defaultHomeFilter: "all" | "matching" | "nearby";
  backgroundPreferences?: BackgroundPreferences;
};

export type UserSettingsResponse = {
  userId: string;
  settings: Partial<AppSettings>;
  updatedAt: string;
};
