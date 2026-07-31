import { apiClient } from "@/services/apiClient";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface ReportResponse {
  report: {
    id: string;
    targetType: "post" | "comment" | "meal-card" | "user";
    targetId: string;
    reason: string;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
    updatedAt: string;
  };
}

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (response && typeof response === "object" && "success" in response && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }

  return response as T;
}

export async function reportContent(input: {
  targetType: "post" | "comment" | "meal-card" | "user";
  targetId: string;
  reason: string;
}) {
  const response = await apiClient.post<ApiEnvelope<ReportResponse> | ReportResponse>("/reports", input);
  return unwrapData(response).report;
}
