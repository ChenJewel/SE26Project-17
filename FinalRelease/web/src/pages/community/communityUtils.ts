import type {
  CommunityChannel,
  CommunityMediaSource,
  CommunityMediaType,
  CommunityPost,
  CommunityTopic,
} from "@/data/community";

export type ComposerStep = "choice" | "editor" | "drafts" | null;

export type SavedCommunityDraft = {
  id: string;
  title: string;
  text: string;
  place: string;
  topic: CommunityTopic;
  mediaType: CommunityMediaType;
  mediaSource: CommunityMediaSource;
  visibility: string;
  mediaFiles: File[];
  mediaPreviewUrls: string[];
  mediaCount: number;
  updatedAt: string;
};

const communityDraftsKey = "ueat-community-post-drafts";

export const maxPostImageCount = 5;

export const channels: CommunityChannel[] = ["推荐", "关注", "附近", "餐厅", "生活", "经验"];

export const channelHint: Record<CommunityChannel, string> = {
  推荐: "算法个性化内容",
  关注: "关注用户的新动态",
  附近: "周边与校园附近",
  餐厅: "餐厅推荐与评价",
  生活: "日常发现与分享",
  经验: "大学经验与建议",
};

export const tagClass: Record<CommunityTopic, string> = {
  餐厅: "bg-[rgba(255,247,215,0.9)] text-[#806636]",
  生活: "bg-[rgba(209,228,221,0.92)] text-[var(--pine)]",
  经验: "bg-[rgba(183,176,216,0.24)] text-[#625b98]",
};

export function getPostMediaUrls(post: CommunityPost) {
  const urls = post.mediaUrls?.length ? post.mediaUrls : post.mediaUrl ? [post.mediaUrl] : [];
  return post.mediaType === "video" ? urls.slice(0, 1) : urls;
}

export function readSavedCommunityDrafts(): SavedCommunityDraft[] {
  try {
    const raw = window.localStorage.getItem(communityDraftsKey);
    if (!raw) return [];
    const items = JSON.parse(raw) as Array<Omit<SavedCommunityDraft, "mediaFiles" | "mediaPreviewUrls">>;
    return items.map((item) => ({
      ...item,
      mediaFiles: [],
      mediaPreviewUrls: [],
      mediaCount: item.mediaCount ?? 0,
    }));
  } catch (error) {
    console.warn("Failed to read community drafts.", error);
    return [];
  }
}

export function persistSavedCommunityDrafts(drafts: SavedCommunityDraft[]) {
  try {
    const payload = drafts.map(({ mediaFiles: _mediaFiles, mediaPreviewUrls: _mediaPreviewUrls, ...draft }) => draft);
    window.localStorage.setItem(communityDraftsKey, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist community drafts.", error);
  }
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function inferMediaFileMimeType(file: File) {
  if (file.type) return file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeByExtension: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    m4v: "video/mp4",
    "3gp": "video/3gpp",
  };
  return mimeByExtension[extension] ?? "application/octet-stream";
}
