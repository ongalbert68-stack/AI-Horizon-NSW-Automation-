import { apiRequest } from "@/lib/api/client";
import type { Case, CaseOpenInput, CheckResultInput, Page, Ranking } from "@/lib/api/types";

export function listCases(params?: { limit?: number; offset?: number }) {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();
  return apiRequest<Page<Case>>(`/cases${qs ? `?${qs}` : ""}`);
}

export function openCase(data: CaseOpenInput) {
  return apiRequest<Case>("/cases", { method: "POST", body: data });
}

export function getCase(caseId: number) {
  return apiRequest<Case>(`/cases/${caseId}`);
}

export function updateCase(caseId: number, data: Record<string, unknown>) {
  return apiRequest<Case>(`/cases/${caseId}`, { method: "PATCH", body: data });
}

export function createCheckResult(caseId: number, data: CheckResultInput) {
  return apiRequest<Ranking>(`/cases/${caseId}/check-results`, { method: "POST", body: data });
}
