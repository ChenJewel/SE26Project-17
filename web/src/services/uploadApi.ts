import { apiClient } from "@/services/apiClient";
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
  purpose?: "avatar" | "post" | "meal-card" | "chat-image" | "chat-audio" | string;
}) {
  const response = await apiClient.post<ApiEnvelope<{ asset: UploadedAsset }> | { asset: UploadedAsset }>("/uploads", input);
  const asset = unwrapData(response).asset;
  return { ...asset, url: resolveMediaUrl(asset.url) };
}
