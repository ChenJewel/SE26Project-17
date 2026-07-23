import { apiClient } from "@/services/apiClient";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export type EmailCodeStats = {
  dayKey: string;
  timeZone: string;
  limit: number;
  sentCount: number;
  failedCount: number;
  uniqueRecipients: number;
  remaining: number;
};

export type InvitationCodeSummary = {
  id: string;
  label: string;
  codePrefix: string;
  maxUses: number;
  usedCount: number;
  remaining: number;
  active: boolean;
  expired: boolean;
  expiresAt: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type ReportSummary = {
  id: string;
  reporterUserId: string;
  targetType: "post" | "comment" | "meal-card" | "user";
  targetId: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
};

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (response && typeof response === "object" && "success" in response && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }
  return response as T;
}

export async function fetchEmailCodeStats(day?: string) {
  const query = day ? `?day=${encodeURIComponent(day)}` : "";
  const response = await apiClient.get<ApiEnvelope<EmailCodeStats> | EmailCodeStats>(`/auth/admin/email-code-stats${query}`);
  return unwrapData(response);
}

export async function fetchInvitationCodes() {
  const response = await apiClient.get<ApiEnvelope<{ invitations: InvitationCodeSummary[] }> | { invitations: InvitationCodeSummary[] }>("/auth/admin/invitation-codes");
  return unwrapData(response).invitations;
}

export async function createInvitationCode(input: { label?: string; maxUses?: number; expiresInDays?: number }) {
  const response = await apiClient.post<ApiEnvelope<{ invitation: InvitationCodeSummary; code: string }> | { invitation: InvitationCodeSummary; code: string }>(
    "/auth/admin/invitation-codes",
    input
  );
  return unwrapData(response);
}

export async function updateInvitationCode(id: string, input: { active?: boolean; label?: string; maxUses?: number; expiresAt?: string }) {
  const response = await apiClient.patch<ApiEnvelope<{ invitation: InvitationCodeSummary }> | { invitation: InvitationCodeSummary }>(
    `/auth/admin/invitation-codes/${id}`,
    input
  );
  return unwrapData(response).invitation;
}

export async function fetchAdminReports() {
  const response = await apiClient.get<ApiEnvelope<{ reports: ReportSummary[] }> | { reports: ReportSummary[] }>("/admin/reports");
  return unwrapData(response).reports;
}

export async function updateAdminReportStatus(id: string, status: ReportSummary["status"]) {
  const response = await apiClient.patch<ApiEnvelope<{ report: ReportSummary }> | { report: ReportSummary }>(`/admin/reports/${id}`, { status });
  return unwrapData(response).report;
}
