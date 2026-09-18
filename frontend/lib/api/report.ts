import { apiRequest } from "@/lib/api/client";
import type { CloseCaseResponse, Report, Verification } from "@/lib/api/types";

export function getReport(caseId: number, useLlmExplanation: boolean) {
  return apiRequest<Report>(`/cases/${caseId}/report`, {
    searchParams: { use_llm_explanation: useLlmExplanation },
  });
}

export function verifyCase(caseId: number, photo: File, shotsMeasured: number) {
  const form = new FormData();
  form.set("photo", photo);
  form.set("shots_measured", String(shotsMeasured));
  return apiRequest<Verification>(`/cases/${caseId}/verify`, { method: "POST", formData: form });
}

export function closeCase(caseId: number) {
  return apiRequest<CloseCaseResponse>(`/cases/${caseId}/close`, { method: "POST" });
}
