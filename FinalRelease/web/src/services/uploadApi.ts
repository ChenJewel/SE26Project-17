import { ApiError, apiClient } from "@/services/apiClient";
import { runtimeConfig } from "@/config/runtime";
import { resolveMediaUrl } from "@/lib/mediaUrl";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface UploadedAsset {
  id: string;
  storage: "local" | "object-storage";
  url: string;
  mimeType: string;
  size: number;
  purpose: string;
  posterUrl?: string;
  originalUrl?: string;
  transcodeStatus?: "original" | "transcoded" | "failed" | "skipped";
}

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (response && typeof response === "object" && "success" in response && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }
  return response as T;
}

export async function uploadMedia(input: {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  purpose?: "avatar" | "post" | "meal-card" | "chat-image" | "chat-video" | "chat-audio" | "chat-file" | string;
}) {
  const response = await apiClient.post<ApiEnvelope<{ asset: UploadedAsset }> | { asset: UploadedAsset }>("/uploads", input);
  const asset = unwrapData(response).asset;
  return {
    ...asset,
    url: resolveMediaUrl(asset.url),
    posterUrl: asset.posterUrl ? resolveMediaUrl(asset.posterUrl) : undefined,
    originalUrl: asset.originalUrl ? resolveMediaUrl(asset.originalUrl) : undefined,
  };
}

export async function uploadBinaryMedia(input: {
  fileName: string;
  mimeType: string;
  file: Blob;
  purpose?: "avatar" | "post" | "meal-card" | "chat-image" | "chat-video" | "chat-audio" | "chat-file" | string;
}) {
  const params = new URLSearchParams({
    fileName: input.fileName,
    mimeType: input.mimeType,
    purpose: input.purpose ?? "media",
  });
  const headers = new Headers({ "Content-Type": input.mimeType });
  const token = typeof window === "undefined" ? null : window.localStorage.getItem("ueat-auth-token");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${runtimeConfig.apiBaseUrl}/uploads/raw?${params.toString()}`, {
    method: "POST",
    headers,
    body: input.file,
    credentials: "include",
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new ApiError(response.statusText || "Upload failed", response.status, payload);
  }
  const asset = unwrapData(payload as ApiEnvelope<{ asset: UploadedAsset }> | { asset: UploadedAsset }).asset;
  return {
    ...asset,
    url: resolveMediaUrl(asset.url),
    posterUrl: asset.posterUrl ? resolveMediaUrl(asset.posterUrl) : undefined,
    originalUrl: asset.originalUrl ? resolveMediaUrl(asset.originalUrl) : undefined,
  };
}
