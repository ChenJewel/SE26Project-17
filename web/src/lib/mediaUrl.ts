import { runtimeConfig } from "@/config/runtime";

export function resolveMediaUrl(url?: string) {
  if (!url) return "";
  if (/^(blob:|data:)/.test(url)) return url;

  try {
    const apiUrl = new URL(runtimeConfig.apiBaseUrl);
    const parsed = url.startsWith("/") ? new URL(url, apiUrl.origin) : new URL(url);
    if (parsed.pathname.startsWith("/uploads/")) {
      return `${runtimeConfig.apiBaseUrl}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    if (url.startsWith("/")) return `${apiUrl.origin}${url}`;
    return parsed.toString();
  } catch {
    return url;
  }
}

export const resolveAvatarUrl = resolveMediaUrl;
