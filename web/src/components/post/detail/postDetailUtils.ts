import { Share } from "@capacitor/share";
import type { CommunityComment, CommunityPost } from "@/data/community";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export type ShareTarget = {
  id: string;
  label: string;
  avatar: string;
  userId?: string;
  conversationId?: string;
  meta?: string;
};

export type SharePayload =
  | { type: "post"; post: CommunityPost }
  | { type: "comment"; post: CommunityPost; comment: CommunityComment };

export type ExternalShareChannel = "wechat" | "moments" | "qq" | "qzone";
export function getPostMediaUrls(post: CommunityPost) {
  const urls = post.mediaUrls?.length ? post.mediaUrls : post.mediaUrl ? [post.mediaUrl] : [];
  return post.mediaType === "video" ? urls.slice(0, 1) : urls;
}

export function projectMomentum(initialVelocity: number, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export function buildShareText(payload: SharePayload, note = "") {
  const trimmedNote = note.trim();
  const shareText =
    payload.type === "comment"
      ? `转发评论：${payload.comment.author}：${payload.comment.text}\n来自帖子《${payload.post.title}》`
      : `转发帖子：${payload.post.title}\n${payload.post.text}`;
  return trimmedNote ? `${trimmedNote}\n\n${shareText}` : shareText;
}

export function buildExternalShareText(payload: SharePayload, note: string, url: string) {
  return `${buildShareText(payload, note)}\n${url}`;
}

export function buildQzoneShareUrl(payload: SharePayload, url: string) {
  const summary = payload.type === "comment"
    ? `${payload.comment.author}：${payload.comment.text}`
    : payload.post.text;
  const params = new URLSearchParams({
    url,
    title: payload.post.title,
    summary,
    desc: summary,
  });
  const image = resolveMediaUrl(getPostMediaUrls(payload.post)[0]);
  if (image) params.set("pics", image);
  return `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?${params.toString()}`;
}

export function buildQQFriendShareUrls(payload: SharePayload, url: string) {
  const summary = payload.type === "comment"
    ? `${payload.comment.author}：${payload.comment.text}`
    : payload.post.text;
  const image = resolveMediaUrl(getPostMediaUrls(payload.post)[0]);
  const params = new URLSearchParams({
    src_type: "web",
    version: "1",
    file_type: "news",
    share_id: "1103188687",
    title: payload.post.title,
    description: summary,
    url,
    app_name: "ueat",
  });
  if (image) {
    params.set("previewimageUrl", image);
    params.set("image_url", image);
  }

  const webParams = new URLSearchParams({
    url,
    title: payload.post.title,
    summary,
    desc: summary,
  });
  if (image) webParams.set("pics", image);

  return {
    appUrl: `mqqapi://share/to_fri?${params.toString()}`,
    webUrl: `https://connect.qq.com/widget/shareqq/index.html?${webParams.toString()}`,
  };
}

export function buildPostShareSnapshot(post: CommunityPost) {
  return {
    id: post.id,
    title: post.title,
    text: post.text,
    author: post.author,
    avatar: post.avatar,
    topic: post.topic,
    mediaType: post.mediaType,
    mediaUrl: resolveMediaUrl(getPostMediaUrls(post)[0]),
    mediaUrls: getPostMediaUrls(post).map(resolveMediaUrl),
    imageTone: post.imageTone,
    place: post.place,
  };
}

export function buildCommentShareSnapshot(comment: CommunityComment, post: CommunityPost) {
  return {
    id: comment.id,
    postId: post.id,
    text: comment.text,
    author: comment.author,
    avatar: comment.avatar,
    postTitle: post.title,
    postAuthor: post.author,
    postMediaUrl: resolveMediaUrl(getPostMediaUrls(post)[0]),
    postMediaType: post.mediaType,
  };
}

export function downloadUrl(url: string, fallbackName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fallbackName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function readStringList(key: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to the selection-based copy path below.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

export function openExternalUrl(url: string, fallbackUrl?: string) {
  if (/^(mqqapi|weixin):\/\//.test(url)) {
    let fallbackTimer = 0;
    const clearFallback = () => {
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      document.removeEventListener("visibilitychange", clearFallback);
      window.removeEventListener("pagehide", clearFallback);
    };

    if (fallbackUrl) {
      document.addEventListener("visibilitychange", clearFallback, { once: true });
      window.addEventListener("pagehide", clearFallback, { once: true });
      fallbackTimer = window.setTimeout(() => {
        clearFallback();
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      }, 900);
    }

    const frame = document.createElement("iframe");
    frame.style.display = "none";
    frame.src = url;
    document.body.appendChild(frame);
    window.setTimeout(() => frame.remove(), 1200);
    window.location.href = url;
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

type NativeShareOptions = {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
};

export async function openSystemShare(options: NativeShareOptions) {
  const canNativeShare = await Share.canShare().catch(() => ({ value: false }));
  if (canNativeShare.value) {
    await Share.share(options);
    return true;
  }

  if (navigator.share) {
    await navigator.share({ title: options.title, text: options.text, url: options.url });
    return true;
  }

  return false;
}

export function getPostShareUrl(postId: string) {
  const origin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(window.location.origin)
    ? "http://10.119.5.83"
    : window.location.origin;
  return `${origin}/?post=${encodeURIComponent(postId)}`;
}

export function dedupeTargets(targets: ShareTarget[]) {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = target.userId ? `user-${target.userId}` : target.conversationId ? `conv-${target.conversationId}` : target.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
