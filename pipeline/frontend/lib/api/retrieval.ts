import { apiRequest } from "@/lib/api/client";
import type { CoarseMatch, Precedents } from "@/lib/api/types";

export function getCoarseMatches(caseId: number) {
  return apiRequest<CoarseMatch[]>(`/cases/${caseId}/retrieval/coarse`);
}

/** The learning-database tally. Descriptive only — it never moves the
 * ranking, which takes precedent through Gate B alone. */
export function getPrecedents(caseId: number) {
  return apiRequest<Precedents>(`/cases/${caseId}/retrieval/precedents`);
}
