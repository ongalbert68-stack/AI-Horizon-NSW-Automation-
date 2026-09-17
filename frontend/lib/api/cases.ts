import { apiRequest } from "@/lib/api/client";
import type { Case, CaseInput, CheckResult, CheckResultInput, Page } from "@/lib/api/types";

export function listCases(params?: { limit?: number; offset?: number }) {
  return apiRequest<Page<Case>>("/cases", { searchParams: params });
}

export function getCase(caseId: number) {
  return apiRequest<Case>(`/cases/${caseId}`);
}

export function createCase(data: CaseInput) {
  return apiRequest<Case>("/cases", { method: "POST", body: data });
}

export function updateCase(caseId: number, data: Partial<CaseInput>) {
  return apiRequest<Case>(`/cases/${caseId}`, { method: "PATCH", body: data });
}

export function deleteCase(caseId: number) {
  return apiRequest<void>(`/cases/${caseId}`, { method: "DELETE" });
}

export function listCheckResults(caseId: number) {
  return apiRequest<CheckResult[]>(`/cases/${caseId}/check-results`);
}

export function createCheckResult(caseId: number, data: CheckResultInput) {
  return apiRequest<CheckResult>(`/cases/${caseId}/check-results`, { method: "POST", body: data });
}

export function updateCheckResult(
  caseId: number,
  checkResultId: number,
  data: Partial<CheckResultInput>,
) {
  return apiRequest<CheckResult>(`/cases/${caseId}/check-results/${checkResultId}`, {
    method: "PATCH",
    body: data,
  });
}

export function deleteCheckResult(caseId: number, checkResultId: number) {
  return apiRequest<void>(`/cases/${caseId}/check-results/${checkResultId}`, { method: "DELETE" });
}
