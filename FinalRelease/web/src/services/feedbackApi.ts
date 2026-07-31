import { apiClient } from "@/services/apiClient";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export type FeedbackCategory = "bug" | "experience" | "feature" | "other";

export type FeedbackSummary = {
  id: string;
  userId: string;
  category: FeedbackCategory;
  text: string;
  contact?: string;
  status: "open" | "reviewed" | "closed";
  appVersion?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
};

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (response && typeof response === "object" && "success" in response && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }
  return response as T;
}

export async function submitFeedback(input: {
  category: FeedbackCategory;
  text: string;
  contact?: string;
  appVersion?: string;
}) {
  const response = await apiClient.post<ApiEnvelope<{ feedback: FeedbackSummary }> | { feedback: FeedbackSummary }>("/feedback", input);
  return unwrapData(response).feedback;
}
