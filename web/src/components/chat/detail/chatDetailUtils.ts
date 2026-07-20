import { ApiError } from "@/services/apiClient";
import type { PublicPetSummary } from "@/services/petApi";
import type { MealExchangeRequest } from "@/types/exchange";

export type LocalChatSettings = {
  remark: string;
  muted: boolean;
  pinned: boolean;
  blocked: boolean;
  groupNickname: string;
  groupRemark: string;
  announcement: string;
};
export function defaultLocalChatSettings(): LocalChatSettings {
  return {
    remark: "",
    muted: false,
    pinned: false,
    blocked: false,
    groupNickname: "",
    groupRemark: "",
    announcement: "",
  };
}

export function chatSettingsKey(conversationId: string) {
  return `ueat-chat-settings-${conversationId}`;
}

export function loadLocalChatSettings(conversationId: string): LocalChatSettings {
  try {
    const raw = window.localStorage.getItem(chatSettingsKey(conversationId));
    if (!raw) return defaultLocalChatSettings();
    return { ...defaultLocalChatSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultLocalChatSettings();
  }
}

export function readApiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return undefined;
  if (error.status === 413) return "\u6587\u4ef6\u592a\u5927\uff0c\u56fe\u7247/\u89c6\u9891\u8bf7\u5c0f\u4e8e 1GB\u3002";
  const payload = error.payload as { error?: { code?: unknown; message?: unknown } } | undefined;
  if (payload?.error?.code === "USER_BLOCKED") return "你被屏蔽/拉黑，不能发送消息";
  if (payload?.error?.code === "STRANGER_MESSAGE_LIMIT") {
    return typeof payload.error.message === "string" ? payload.error.message : "你们还不是互相关注好友，24 小时内最多发送 3 条普通消息。";
  }
  if (payload?.error?.code === "UNSUPPORTED_MEDIA_TYPE") return "\u8fd9\u4e2a\u56fe\u7247/\u89c6\u9891\u683c\u5f0f\u6682\u4e0d\u652f\u6301\uff0c\u8bf7\u6362\u4e00\u4e2a\u6587\u4ef6\u3002";
  if (payload?.error?.code === "INVALID_UPLOAD_SIZE") return "\u6587\u4ef6\u4e3a\u7a7a\u6216\u592a\u5927\uff0c\u56fe\u7247/\u89c6\u9891\u8bf7\u5c0f\u4e8e 1GB\u3002";
  if (payload?.error?.code === "INVALID_UPLOAD") return "\u4e0a\u4f20\u53c2\u6570\u4e0d\u5b8c\u6574\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u6587\u4ef6\u3002";
  return typeof payload?.error?.message === "string" ? payload.error.message : undefined;
}

export function mapCloudExchangeRequests(
  requests: Array<{
    id: string;
    senderUserId?: string;
    receiverUserId?: string;
    conversationId: string;
    targetCardId: string;
    ownCardId?: string;
    status: "pending" | "accepted" | "rejected";
  }>,
  cards: Array<MealExchangeRequest["targetCard"]>
): MealExchangeRequest[] {
  return requests.flatMap((request) => {
    const targetCard = cards.find((card) => card.id === request.targetCardId);
    if (!targetCard) return [];
    const ownCard = request.ownCardId ? cards.find((card) => card.id === request.ownCardId) : undefined;
    return [{
      id: request.id,
      senderUserId: request.senderUserId,
      receiverUserId: request.receiverUserId,
      conversationId: request.conversationId,
      targetName: targetCard.nickname,
      targetCard,
      ownCard,
      status: request.status,
    }];
  });
}

export function mergeExchangeRequests(localRequests: MealExchangeRequest[], cloudRequests: MealExchangeRequest[]) {
  return Array.from(
    new Map([...cloudRequests, ...localRequests].map((request) => [request.id, request])).values()
  );
}

export function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatFileSize(value: number) {
  if (!value) return "文件";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}


export async function inferVisualMediaMimeType(file: File) {
  const mimeType = await inferUploadMimeType(file);
  if (mimeType.startsWith("image/") || mimeType.startsWith("video/")) return mimeType;
  return sniffVisualMediaMimeType(file);
}

export async function inferUploadMimeType(file: File) {
  const mimeType = inferFileMimeType(file);
  if (mimeType !== "application/octet-stream") return mimeType;
  return (await sniffVisualMediaMimeType(file)) || mimeType;
}

async function sniffVisualMediaMimeType(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const ascii = String.fromCharCode(...bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii.slice(1, 4) === "PNG") return "image/png";
  if (ascii.startsWith("GIF8")) return "image/gif";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 11) === "AVI") return "video/x-msvideo";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm";
  if (ascii.slice(4, 8) === "ftyp") {
    const brand = ascii.slice(8, 16).toLowerCase();
    if (/heic|heix|hevc|hevx|mif1|msf1/.test(brand)) return "image/heic";
    if (/qt  /.test(brand)) return "video/quicktime";
    return "video/mp4";
  }
  return "application/octet-stream";
}

export function inferFileMimeType(file: File) {
  const name = file.name.toLowerCase();
  if (file.type && file.type !== "application/octet-stream") {
    if (file.type === "image/jpg") return "image/jpeg";
    if (file.type === "video/mov") return "video/quicktime";
    return file.type;
  }
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  if (name.endsWith(".avif")) return "image/avif";
  if (name.endsWith(".bmp")) return "image/bmp";
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".m4v")) return "video/x-m4v";
  if (name.endsWith(".3gp")) return "video/3gpp";
  if (name.endsWith(".3g2")) return "video/3gpp2";
  if (name.endsWith(".avi")) return "video/x-msvideo";
  if (name.endsWith(".mkv")) return "video/x-matroska";
  if (name.endsWith(".mp3")) return "audio/mpeg";
  if (name.endsWith(".m4a")) return "audio/mp4";
  if (name.endsWith(".aac")) return "audio/aac";
  if (name.endsWith(".wav")) return "audio/wav";
  if (name.endsWith(".ogg")) return "audio/ogg";
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".zip")) return "application/zip";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (name.endsWith(".xls")) return "application/vnd.ms-excel";
  if (name.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (name.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (name.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

export function defaultExtensionForMimeType(mimeType: string) {
  const extensionByMimeType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
    "image/bmp": "bmp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/x-m4v": "m4v",
    "video/x-msvideo": "avi",
    "video/x-matroska": "mkv",
    "video/3gpp": "3gp",
    "video/3gpp2": "3g2",
  };
  return extensionByMimeType[mimeType] ?? (mimeType.startsWith("video/") ? "mp4" : "jpg");
}

export function isConversationEvent(data: unknown, conversationId: string) {
  return (
    typeof data === "object" &&
    data !== null &&
    "conversationId" in data &&
    (data as { conversationId?: unknown }).conversationId === conversationId
  );
}

export function isUserProfileUpdatedEvent(data: unknown): data is { user: { id: string; nickname: string; avatarText: string; avatarUrl?: string; verified: boolean } } {
  if (!data || typeof data !== "object") return false;
  const user = (data as { user?: unknown }).user;
  return Boolean(
    user &&
      typeof user === "object" &&
      typeof (user as { id?: unknown }).id === "string" &&
      typeof (user as { nickname?: unknown }).nickname === "string" &&
      typeof (user as { avatarText?: unknown }).avatarText === "string"
  );
}

export function isUserPetUpdatedEvent(data: unknown): data is { userId: string; pet: PublicPetSummary | null } {
  return Boolean(
    data &&
      typeof data === "object" &&
      typeof (data as { userId?: unknown }).userId === "string" &&
      ("pet" in data)
  );
}

export function readSessionDescription(value: unknown): RTCSessionDescriptionInit | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if ((raw.type === "offer" || raw.type === "answer") && typeof raw.sdp === "string") {
    return { type: raw.type, sdp: raw.sdp };
  }
  return null;
}

export function readIceCandidate(value: unknown): RTCIceCandidateInit | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.candidate !== "string") return null;
  return {
    candidate: raw.candidate,
    sdpMid: typeof raw.sdpMid === "string" ? raw.sdpMid : null,
    sdpMLineIndex: typeof raw.sdpMLineIndex === "number" ? raw.sdpMLineIndex : null,
    usernameFragment: typeof raw.usernameFragment === "string" ? raw.usernameFragment : undefined,
  };
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

export function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function readAudioDuration(file: File) {
  return new Promise<number>((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
    };
    audio.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 1;
      cleanup();
      resolve(duration);
    }, { once: true });
    audio.addEventListener("error", () => {
      cleanup();
      resolve(1);
    }, { once: true });
    audio.src = url;
  });
}
