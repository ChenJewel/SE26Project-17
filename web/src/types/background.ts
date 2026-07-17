export type BackgroundSource = "system" | "upload";

export interface AppBackground {
  id: string;
  name: string;
  url: string;
  source: BackgroundSource;
  updatedAt: string;
}

export interface BackgroundPreferences {
  home?: AppBackground | null;
  chats?: Record<string, AppBackground | null | undefined>;
}
