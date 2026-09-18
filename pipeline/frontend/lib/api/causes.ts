import { apiRequest } from "@/lib/api/client";
import type { CauseComparison, CauseVocab } from "@/lib/api/types";

export function listCauses() {
  return apiRequest<CauseVocab[]>("/causes");
}

export function compareCauses(caseId: number) {
  return apiRequest<CauseComparison[]>(`/cases/${caseId}/compare`);
}
